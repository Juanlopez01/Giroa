-- =============================================================================
-- Reglas comerciales:
--   * Todo estudio nuevo arranca en plan Inicial con 14 días de prueba.
--     El plan lo cambia Giroa (service role).
--   * Al llegar al límite de alumnos activos del plan se bloquean las altas de
--     alumnos nuevos. Nunca se bloquean reservas de alumnos existentes, y
--     vincular un perfil ya cargado (join_studio por email) no es un alta.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- create_studio sin elección de plan.
-- ---------------------------------------------------------------------------
drop function public.create_studio(text, text, public.studio_plan);

create function public.create_studio(p_name text, p_slug text)
returns public.studios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slug text := lower(btrim(p_slug));
  v_studio public.studios%rowtype;
begin
  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión.', 'not_authenticated');
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 80 then
    perform private.fail('El nombre del estudio tiene que tener entre 2 y 80 caracteres.', 'invalid_name');
  end if;

  case public.check_slug(v_slug)
    when 'invalid' then
      perform private.fail('La dirección solo puede tener letras minúsculas, números y guiones (de 3 a 40, sin guion al principio ni al final).', 'invalid_slug');
    when 'reserved' then
      perform private.fail('Esa dirección está reservada. Probá con otra.', 'slug_reserved');
    when 'taken' then
      perform private.fail('Esa dirección ya está en uso. Probá con otra.', 'slug_taken');
    else null;
  end case;

  begin
    insert into public.studios (slug, name, plan)
    values (v_slug, btrim(p_name), 'inicial')
    returning * into v_studio;
  exception when unique_violation then
    perform private.fail('Esa dirección ya está en uso. Probá con otra.', 'slug_taken');
  end;

  insert into public.studio_members (studio_id, user_id, role)
  values (v_studio.id, v_uid, 'owner');

  insert into public.studio_subscriptions (studio_id, status, trial_ends_at)
  values (v_studio.id, 'trialing', now() + interval '14 days');

  return v_studio;
end;
$$;

revoke execute on function public.create_studio(text, text) from public, anon, authenticated;
grant execute on function public.create_studio(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Límite de alumnos activos.
-- ---------------------------------------------------------------------------
create function private.studio_at_student_limit(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.max_active_students is not null
     and (select count(*) from private.active_student_ids(p_studio_id)) >= p.max_active_students
  from public.studios st
  join public.plans p on p.key = st.plan
  where st.id = p_studio_id
$$;

grant execute on function private.studio_at_student_limit(uuid) to authenticated, service_role;

-- Cubre las altas del staff (insert directo con RLS) y las de join_studio.
-- Giroa (service role / interno) puede cargar igual, p. ej. en una migración.
create function private.students_enforce_plan_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_privileged() and coalesce(private.studio_at_student_limit(new.studio_id), false) then
    perform private.fail(
      'Llegaste al límite de alumnos activos de tu plan. Pasate a un plan mayor para sumar alumnos nuevos.',
      'plan_limit_reached'
    );
  end if;
  return new;
end;
$$;

grant execute on function private.students_enforce_plan_limit() to authenticated, service_role;

create trigger students_enforce_plan_limit before insert on public.students
  for each row execute function private.students_enforce_plan_limit();

-- join_studio: mensaje pensado para el alumno (no para el dueño).
create or replace function public.join_studio(
  p_slug text,
  p_full_name text,
  p_phone text default null,
  p_role public.dance_role default null
)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_studio_id uuid;
  v_student public.students%rowtype;
begin
  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión.', 'not_authenticated');
  end if;

  select st.id into v_studio_id
  from public.studios st
  where st.slug = lower(btrim(p_slug)) and st.is_active;
  if v_studio_id is null then
    perform private.fail('No encontramos ese estudio.', 'studio_not_found');
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  select * into v_student
  from public.students s
  where s.studio_id = v_studio_id and s.user_id = v_uid
  for update;

  if found then
    update public.students s set
      full_name = coalesce(nullif(btrim(p_full_name), ''), s.full_name),
      phone = coalesce(nullif(btrim(p_phone), ''), s.phone),
      default_role = coalesce(p_role, s.default_role)
    where s.id = v_student.id
    returning * into v_student;
    return v_student;
  end if;

  if v_email is not null then
    select * into v_student
    from public.students s
    where s.studio_id = v_studio_id and s.email = v_email and s.user_id is null
    for update;

    if found then
      update public.students s set
        user_id = v_uid,
        full_name = coalesce(nullif(btrim(p_full_name), ''), s.full_name),
        phone = coalesce(nullif(btrim(p_phone), ''), s.phone),
        default_role = coalesce(p_role, s.default_role)
      where s.id = v_student.id
      returning * into v_student;
      return v_student;
    end if;
  end if;

  if p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 120 then
    perform private.fail('Contanos tu nombre para sumarte al estudio.', 'invalid_name');
  end if;

  if private.studio_at_student_limit(v_studio_id) then
    perform private.fail(
      'Por ahora el estudio no está sumando alumnos nuevos desde la app. Escribiles para anotarte.',
      'plan_limit_reached'
    );
  end if;

  insert into public.students (studio_id, user_id, full_name, email, phone, default_role)
  values (v_studio_id, v_uid, p_full_name, v_email, p_phone, p_role)
  returning * into v_student;

  return v_student;
end;
$$;

-- studio_usage: suma at_limit y el fin de la prueba para los avisos del panel.
create or replace function public.studio_usage(p_studio_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_active integer;
  v_sub public.studio_subscriptions%rowtype;
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('No tenés permiso para ver esta información.', 'forbidden');
  end if;

  select p.* into v_plan
  from public.plans p join public.studios st on st.plan = p.key
  where st.id = p_studio_id;

  select count(*)::integer into v_active from private.active_student_ids(p_studio_id);
  select * into v_sub from public.studio_subscriptions where studio_id = p_studio_id;

  return jsonb_build_object(
    'plan', v_plan.key,
    'max_active_students', v_plan.max_active_students,
    'active_students', v_active,
    'at_limit', v_plan.max_active_students is not null and v_active >= v_plan.max_active_students,
    'over_limit', v_plan.max_active_students is not null and v_active > v_plan.max_active_students,
    'subscription_status', v_sub.status,
    'trial_ends_at', v_sub.trial_ends_at
  );
end;
$$;
