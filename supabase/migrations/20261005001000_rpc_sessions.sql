-- =============================================================================
-- Generación de sesiones desde los horarios semanales. Nunca duplica:
-- unique (schedule_id, starts_at) + on conflict do nothing.
-- =============================================================================

create function private.generate_sessions_core(p_studio_id uuid, p_from date, p_weeks integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.sessions (studio_id, offering_id, schedule_id, starts_at, ends_at)
  select
    cs.studio_id,
    cs.offering_id,
    cs.id,
    (g.day + cs.start_time) at time zone st.timezone,
    ((g.day + cs.start_time) at time zone st.timezone) + make_interval(mins => cs.duration_minutes)
  from public.class_schedules cs
  join public.offerings o on o.id = cs.offering_id
  join public.studios st on st.id = cs.studio_id
  cross join lateral (
    select d::date as day
    from generate_series(p_from::timestamp, (p_from + (p_weeks * 7 - 1))::timestamp, interval '1 day') as d
  ) g
  where cs.studio_id = p_studio_id
    and st.is_active
    and cs.is_active
    and o.is_active
    and o.kind = 'regular'
    and extract(dow from g.day) = cs.weekday
    and (cs.valid_from is null or g.day >= cs.valid_from)
    and (cs.valid_until is null or g.day <= cs.valid_until)
    and ((g.day + cs.start_time) at time zone st.timezone) > now()
  on conflict (schedule_id, starts_at) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.generate_sessions_core(uuid, date, integer) from public, anon, authenticated;

-- p_from: por defecto, hoy en la zona horaria del estudio.
create function public.generate_sessions(
  p_studio_id uuid,
  p_from date default null,
  p_weeks integer default 4
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date;
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('No tenés permiso para generar clases en este estudio.', 'forbidden');
  end if;

  if p_weeks is null or p_weeks not between 1 and 12 then
    perform private.fail('Se pueden generar entre 1 y 12 semanas.', 'invalid_weeks');
  end if;

  select coalesce(p_from, (now() at time zone st.timezone)::date) into v_from
  from public.studios st where st.id = p_studio_id;

  if v_from is null then
    perform private.fail('No encontramos ese estudio.', 'studio_not_found');
  end if;

  return private.generate_sessions_core(p_studio_id, v_from, p_weeks);
end;
$$;

-- Para el cron semanal: todos los estudios activos.
create function private.generate_sessions_all(p_weeks integer default 4)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_studio record;
begin
  for v_studio in select id, timezone from public.studios where is_active loop
    v_total := v_total + private.generate_sessions_core(
      v_studio.id, (now() at time zone v_studio.timezone)::date, p_weeks
    );
  end loop;
  return v_total;
end;
$$;

revoke execute on function private.generate_sessions_all(integer) from public, anon, authenticated;

grant execute on function public.generate_sessions(uuid, date, integer) to authenticated, service_role;
