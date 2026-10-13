-- =============================================================================
-- Aviso cuando rebota un abono: MP rechazó un cobro o pausó el débito (los dos
-- caminos ponen failed_at). Mail al alumno (membership_failed) y a los dueños y
-- encargados (membership_failed_staff).
--
-- Un aviso por rebote: failed_at queda fijo mientras MP reintenta y se limpia
-- con el próximo cobro aprobado, así que si vuelve a rebotar después, avisa de
-- nuevo (el dedupe_key lleva el failed_at).
-- =============================================================================

create function private.notify_membership_failed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'membership_failed:' || new.id || ':' || floor(extract(epoch from new.failed_at))::bigint;
  v_student_name text;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  perform private.enqueue_notification(
    new.studio_id, new.student_id, 'membership_failed',
    jsonb_build_object('name', new.name, 'amount_cents', new.amount_cents),
    now(), v_key
  );

  select full_name into v_student_name from public.students where id = new.student_id;

  insert into public.notifications (studio_id, template, to_address, payload, dedupe_key)
  select
    new.studio_id, 'membership_failed_staff', u.email,
    jsonb_build_object(
      'staff_name', m.display_name,
      'student_name', v_student_name,
      'name', new.name,
      'amount_cents', new.amount_cents,
      'error', new.last_error
    ),
    v_key || ':' || m.user_id
  from public.studio_members m
  join auth.users u on u.id = m.user_id
  where m.studio_id = new.studio_id and m.role in ('owner', 'admin') and u.email is not null
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke execute on function private.notify_membership_failed() from public, anon, authenticated;

create trigger student_subscriptions_notify_failed
  after update of failed_at on public.student_subscriptions
  for each row
  when (old.failed_at is null and new.failed_at is not null)
  execute function private.notify_membership_failed();
