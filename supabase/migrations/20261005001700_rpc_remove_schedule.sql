-- =============================================================================
-- remove_schedule: quita un horario semanal. Borra las sesiones futuras de ese
-- horario que no tienen reservas activas; las que tienen gente anotada quedan
-- (el estudio decide si las cancela con cancel_session, que devuelve créditos).
-- Devuelve cuántas sesiones futuras quedaron por tener reservas.
-- =============================================================================

create function public.remove_schedule(p_schedule_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.class_schedules%rowtype;
  v_kept integer;
begin
  select * into v_schedule from public.class_schedules where id = p_schedule_id for update;
  if not found or not (private.is_privileged() or private.is_studio_admin(v_schedule.studio_id)) then
    perform private.fail('No encontramos ese horario.', 'schedule_not_found');
  end if;

  delete from public.sessions s
  where s.schedule_id = v_schedule.id
    and s.starts_at > now()
    and not exists (select 1 from public.bookings b where b.session_id = s.id);

  select count(*)::integer into v_kept
  from public.sessions s
  where s.schedule_id = v_schedule.id and s.starts_at > now() and s.status = 'scheduled';

  delete from public.class_schedules where id = v_schedule.id;

  return v_kept;
end;
$$;

revoke execute on function public.remove_schedule(uuid) from public, anon, authenticated;
grant execute on function public.remove_schedule(uuid) to authenticated, service_role;
