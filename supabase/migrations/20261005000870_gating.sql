-- =============================================================================
-- Feature gating central por plan y conteo de alumnos activos.
-- "Alumno activo" = tiene un pack usable o asistió en los últimos 30 días.
-- El código TS usa el mismo catálogo (plan_features) vía src/lib/gating.
-- =============================================================================

create function public.studio_has_feature(p_studio_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.studios st
    join public.plan_features pf on pf.plan = st.plan
    where st.id = p_studio_id and pf.feature = p_feature
  )
$$;

create function private.active_student_ids(p_studio_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  where s.studio_id = p_studio_id
    and s.is_active
    and (
      exists (
        select 1 from public.student_packs sp
        where (sp.student_id = s.id or sp.partner_student_id = s.id)
          and sp.status = 'active'
          and sp.expires_at > now()
          and (sp.credits_total is null or sp.credits_used < sp.credits_total)
      )
      or exists (
        select 1 from public.bookings b
        where b.student_id = s.id
          and b.status = 'attended'
          and b.checked_in_at > now() - interval '30 days'
      )
    )
$$;

create function public.active_students_count(p_studio_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_privileged() or private.is_studio_staff(p_studio_id)) then
    perform private.fail('No tenés permiso para ver esta información.', 'forbidden');
  end if;
  return (select count(*)::integer from private.active_student_ids(p_studio_id));
end;
$$;

-- Uso del plan para el panel: { plan, max_active_students, active_students, over_limit }.
create function public.studio_usage(p_studio_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_active integer;
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('No tenés permiso para ver esta información.', 'forbidden');
  end if;

  select p.* into v_plan
  from public.plans p join public.studios st on st.plan = p.key
  where st.id = p_studio_id;

  select count(*)::integer into v_active from private.active_student_ids(p_studio_id);

  return jsonb_build_object(
    'plan', v_plan.key,
    'max_active_students', v_plan.max_active_students,
    'active_students', v_active,
    'over_limit', v_plan.max_active_students is not null and v_active > v_plan.max_active_students
  );
end;
$$;

grant execute on function public.studio_has_feature(uuid, text) to anon, authenticated, service_role;
grant execute on function public.active_students_count(uuid) to authenticated, service_role;
grant execute on function public.studio_usage(uuid) to authenticated, service_role;
