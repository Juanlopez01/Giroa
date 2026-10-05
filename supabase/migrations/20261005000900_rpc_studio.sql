-- =============================================================================
-- RPC de estudio y alumno: alta de estudio, disponibilidad de slug, sumarse a
-- un estudio, perfil propio, grilla pública y estado de Mercado Pago.
-- =============================================================================

-- 'available' | 'invalid' | 'reserved' | 'taken'
create function public.check_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_slug is null
      or p_slug !~ '^[a-z0-9-]{3,40}$' or p_slug ~ '^-' or p_slug ~ '-$' then 'invalid'
    when private.is_reserved_slug(p_slug) then 'reserved'
    when exists (select 1 from public.studios where slug = p_slug) then 'taken'
    else 'available'
  end
$$;

create function public.create_studio(
  p_name text,
  p_slug text,
  p_plan public.studio_plan default 'inicial'
)
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
    values (v_slug, btrim(p_name), coalesce(p_plan, 'inicial'))
    returning * into v_studio;
  exception when unique_violation then
    perform private.fail('Esa dirección ya está en uso. Probá con otra.', 'slug_taken');
  end;

  insert into public.studio_members (studio_id, user_id, role)
  values (v_studio.id, v_uid, 'owner');

  insert into public.studio_subscriptions (studio_id) values (v_studio.id);

  return v_studio;
end;
$$;

-- El alumno se suma al estudio. Si el estudio ya lo había cargado con ese
-- email, se vincula ese perfil (el email viene verificado por el magic link).
create function public.join_studio(
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

  -- Ya está vinculado: actualiza lo que haya mandado.
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

  -- El estudio lo había cargado con su email: vincula ese perfil.
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

  insert into public.students (studio_id, user_id, full_name, email, phone, default_role)
  values (v_studio_id, v_uid, p_full_name, v_email, p_phone, p_role)
  returning * into v_student;

  return v_student;
end;
$$;

create function public.update_my_student_profile(
  p_student_id uuid,
  p_full_name text,
  p_phone text default null,
  p_default_role public.dance_role default null
)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
begin
  if p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 120 then
    perform private.fail('El nombre no puede quedar vacío.', 'invalid_name');
  end if;

  update public.students s set
    full_name = p_full_name,
    phone = p_phone,
    default_role = p_default_role
  where s.id = p_student_id and s.user_id = auth.uid() and auth.uid() is not null
  returning * into v_student;

  if not found then
    perform private.fail('No encontramos tu perfil.', 'student_not_found');
  end if;
  return v_student;
end;
$$;

-- Grilla pública con cupos y conteo por rol (sin datos personales).
create function public.list_public_sessions(
  p_slug text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  session_id uuid,
  offering_id uuid,
  title text,
  description text,
  discipline_key text,
  discipline_name text,
  level text,
  teacher_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.session_status,
  capacity integer,
  booked_count integer,
  leader_count integer,
  follower_count integer,
  spots_left integer,
  role_balance boolean,
  role_balance_max_diff smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '35 days' then
    perform private.fail('El rango de fechas no es válido (máximo 35 días).', 'invalid_range');
  end if;

  return query
  select
    s.id,
    o.id,
    o.title,
    o.description,
    d.key,
    d.name,
    o.level,
    coalesce(o.teacher_name, m.display_name),
    s.starts_at,
    s.ends_at,
    s.status,
    coalesce(s.capacity_override, o.capacity),
    coalesce(c.booked, 0),
    coalesce(c.leaders, 0),
    coalesce(c.followers, 0),
    greatest(coalesce(s.capacity_override, o.capacity) - coalesce(c.booked, 0), 0),
    coalesce((d.features ->> 'role_balance')::boolean, false),
    o.role_balance_max_diff
  from public.studios st
  join public.sessions s on s.studio_id = st.id
  join public.offerings o on o.id = s.offering_id
  join public.disciplines d on d.key = o.discipline_key
  left join public.studio_members m on m.id = o.teacher_member_id
  left join lateral (
    select
      count(*)::integer as booked,
      count(*) filter (where b.dance_role = 'leader')::integer as leaders,
      count(*) filter (where b.dance_role = 'follower')::integer as followers
    from public.bookings b
    where b.session_id = s.id and b.status in ('booked', 'attended')
  ) c on true
  where st.slug = lower(btrim(p_slug))
    and st.is_active
    and o.is_active
    and o.kind = 'regular'
    and s.starts_at >= p_from
    and s.starts_at < p_to
  order by s.starts_at, o.title;
end;
$$;

-- Estado de la vinculación con MP (sin tokens) para la configuración del estudio.
create function public.mp_connection_status(p_studio_id uuid)
returns table (connected boolean, mp_user_id text, live_mode boolean, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('No tenés permiso para ver esta información.', 'forbidden');
  end if;

  return query
  select true, c.mp_user_id, c.live_mode, c.expires_at
  from public.mp_connections c
  where c.studio_id = p_studio_id;

  if not found then
    return query select false, null::text, null::boolean, null::timestamptz;
  end if;
end;
$$;

grant execute on function public.check_slug(text) to anon, authenticated, service_role;
grant execute on function public.create_studio(text, text, public.studio_plan) to authenticated;
grant execute on function public.join_studio(text, text, text, public.dance_role) to authenticated;
grant execute on function public.update_my_student_profile(uuid, text, text, public.dance_role) to authenticated;
grant execute on function public.list_public_sessions(text, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.mp_connection_status(uuid) to authenticated, service_role;
