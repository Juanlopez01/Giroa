-- =============================================================================
-- Envío de la cola de avisos (public.notifications).
--
-- Cada minuto pg_cron llama (con pg_net) a POST {app}/api/cron/notifications si
-- hay avisos para mandar. El servidor los toma con claim_notifications, manda
-- los mails con Resend y avisa el resultado con finish_notification.
--
-- La URL de la app y el secreto viven en Vault (no en las migraciones):
--   select vault.create_secret('https://app.giroa.com.ar', 'giroa_app_url');
--   select vault.create_secret('<CRON_SECRET>', 'giroa_cron_secret');
-- Sin esos secretos (desarrollo local) el disparador no hace nada.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- Toma hasta p_limit avisos para mandar y los "alquila" 10 minutos (si el
-- servidor se cae a mitad de camino, vuelven a la cola solos).
create function public.claim_notifications(p_limit integer default 50)
returns table (
  id bigint,
  template text,
  to_address text,
  payload jsonb,
  attempts smallint,
  studio_name text,
  studio_slug text,
  studio_timezone text,
  student_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  -- Lo viejo ya no sirve (p. ej. un recordatorio de una clase que pasó).
  update public.notifications n set status = 'skipped', last_error = 'Vencido sin enviar'
  where n.status = 'pending' and n.created_at < now() - interval '2 days';

  return query
  with picked as (
    select n.id
    from public.notifications n
    where n.status = 'pending' and n.send_after <= now() and n.to_address is not null and n.channel = 'email'
    order by n.send_after
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  ),
  leased as (
    update public.notifications n
    set attempts = n.attempts + 1, send_after = now() + interval '10 minutes'
    from picked
    where n.id = picked.id
    returning n.*
  )
  select l.id, l.template, l.to_address, l.payload, l.attempts, s.name, s.slug, s.timezone, st.full_name
  from leased l
  join public.studios s on s.id = l.studio_id
  left join public.students st on st.id = l.student_id;
end;
$$;

-- Resultado del envío. Si falló, reintenta con espera creciente (hasta 5 veces).
create function public.finish_notification(p_id bigint, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  update public.notifications n set
    status = case when p_ok then 'sent' when n.attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() end,
    last_error = case when p_ok then null else left(p_error, 1000) end,
    send_after = case when p_ok then n.send_after else now() + make_interval(mins => 5 * n.attempts) end
  where n.id = p_id;
end;
$$;

-- Disparador: le avisa al servidor que hay avisos para mandar.
create function private.kick_notification_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.notifications
    where status = 'pending' and send_after <= now() and to_address is not null
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'giroa_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'giroa_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function private.kick_notification_worker() from public, anon, authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.finish_notification(bigint, boolean, text) to service_role;

select cron.schedule('giroa_send_notifications', '* * * * *', $$select private.kick_notification_worker()$$);
