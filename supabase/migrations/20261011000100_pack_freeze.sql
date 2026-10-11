-- =============================================================================
-- Congelar packs (feature 'pack_freeze', Estudio y Pro): el alumno se lesiona o
-- se va de viaje y el estudio le pausa el pack.
--
-- Congelado (status 'frozen'): no se usa para reservar ni para el presente
-- (take_credit_for_session solo mira 'active') y no vence (expire_packs solo
-- mira 'active'). Al descongelar, el vencimiento se corre por los días que
-- estuvo congelado. frozen_until (fecha local, inclusive) lo descongela solo.
-- Los packs de un abono mensual no se congelan: se da de baja el abono.
-- =============================================================================

alter table public.student_packs add column frozen_until date;

-- Descongela y corre el vencimiento. Sin chequeo de permisos (lo llaman funciones que ya validaron).
create function private.unfreeze_pack_core(p_pack_id uuid, p_note text)
returns public.student_packs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack public.student_packs%rowtype;
  v_days integer;
begin
  select * into v_pack from public.student_packs where id = p_pack_id for update;
  if v_pack.status <> 'frozen' then
    return v_pack;
  end if;
  v_days := greatest(ceil(extract(epoch from now() - coalesce(v_pack.frozen_at, now())) / 86400)::integer, 0);

  update public.student_packs set
    status = 'active',
    expires_at = expires_at + make_interval(days => v_days),
    frozen_at = null,
    frozen_until = null
  where id = p_pack_id
  returning * into v_pack;

  insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note, created_by)
  values (v_pack.studio_id, v_pack.id, 'adjust', 0,
    format('%s: %s %s, el vencimiento se corrió', p_note, v_days, case when v_days = 1 then 'día' else 'días' end), auth.uid());
  return v_pack;
end;
$$;
revoke execute on function private.unfreeze_pack_core(uuid, text) from public, anon, authenticated;

create function public.freeze_pack(p_pack_id uuid, p_until date default null)
returns public.student_packs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack public.student_packs%rowtype;
  v_tz text;
begin
  select * into v_pack from public.student_packs where id = p_pack_id for update;
  if not found or not private.can_take_payments(v_pack.studio_id) then
    perform private.fail('No encontramos ese pack.', 'pack_not_found');
  end if;
  if not public.studio_has_feature(v_pack.studio_id, 'pack_freeze') then
    perform private.fail('Congelar packs está en el plan Estudio.', 'feature_unavailable');
  end if;
  if v_pack.status = 'frozen' then
    perform private.fail('Este pack ya está congelado.', 'already_frozen');
  end if;
  if v_pack.status <> 'active' or v_pack.expires_at <= now() then
    perform private.fail('Solo se congelan packs vigentes.', 'pack_not_active');
  end if;
  if exists (select 1 from public.payments p where p.id = v_pack.payment_id and p.subscription_id is not null) then
    perform private.fail('Los packs de un abono mensual no se congelan: si el alumno no va a venir, dale de baja el abono.', 'membership_pack');
  end if;
  select timezone into v_tz from public.studios where id = v_pack.studio_id;
  if p_until is not null and p_until < (now() at time zone v_tz)::date then
    perform private.fail('La fecha para descongelar ya pasó.', 'invalid_date');
  end if;

  update public.student_packs set status = 'frozen', frozen_at = now(), frozen_until = p_until
  where id = p_pack_id
  returning * into v_pack;

  insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note, created_by)
  values (v_pack.studio_id, v_pack.id, 'adjust', 0,
    case when p_until is null then 'Pack congelado' else format('Pack congelado hasta el %s', to_char(p_until, 'DD/MM')) end, auth.uid());
  return v_pack;
end;
$$;

create function public.unfreeze_pack(p_pack_id uuid)
returns public.student_packs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack public.student_packs%rowtype;
begin
  select * into v_pack from public.student_packs where id = p_pack_id;
  if not found or not private.can_take_payments(v_pack.studio_id) then
    perform private.fail('No encontramos ese pack.', 'pack_not_found');
  end if;
  if v_pack.status <> 'frozen' then
    perform private.fail('Este pack no está congelado.', 'not_frozen');
  end if;
  return private.unfreeze_pack_core(p_pack_id, 'Descongelado');
end;
$$;

-- Cron diario: descongela los que llegaron a su fecha (el día siguiente al último congelado).
create function public.unfreeze_due_packs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;
  for v_id in
    select sp.id from public.student_packs sp join public.studios st on st.id = sp.studio_id
    where sp.status = 'frozen' and sp.frozen_until is not null
      and sp.frozen_until < (now() at time zone st.timezone)::date
  loop
    perform private.unfreeze_pack_core(v_id, 'Descongelado automático');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.freeze_pack(uuid, date) from public, anon, authenticated;
revoke execute on function public.unfreeze_pack(uuid) from public, anon, authenticated;
revoke execute on function public.unfreeze_due_packs() from public, anon, authenticated;
grant execute on function public.freeze_pack(uuid, date) to authenticated;
grant execute on function public.unfreeze_pack(uuid) to authenticated;
grant execute on function public.unfreeze_due_packs() to service_role;

-- Antes que expire_packs (03:05): primero se descongela, después vence lo que corresponda.
select cron.schedule('giroa_unfreeze_packs', '0 3 * * *', $$select public.unfreeze_due_packs()$$);

-- El saldo muestra hasta cuándo está congelado (columna nueva al final de la vista).
create or replace view public.student_balances
with (security_invoker = true)
as
select
  sp.id as student_pack_id,
  sp.studio_id,
  sp.student_id,
  sp.partner_student_id,
  sp.name,
  sp.credits_total,
  sp.credits_used,
  case when sp.credits_total is null then null
       else sp.credits_total - sp.credits_used end as credits_remaining,
  sp.starts_at,
  sp.expires_at,
  ((sp.expires_at - interval '1 second') at time zone st.timezone)::date as expires_on,
  sp.status,
  (sp.status = 'active'
    and sp.expires_at > now()
    and (sp.credits_total is null or sp.credits_used < sp.credits_total)) as is_usable,
  sp.frozen_until
from public.student_packs sp
join public.studios st on st.id = sp.studio_id;
