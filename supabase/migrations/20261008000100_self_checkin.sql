-- =============================================================================
-- Presente con el QR del estudio: el estudio imprime un cartel con su QR y cada
-- alumno lo escanea con el celular para darse el presente (clases regulares y
-- encuentros de formaciones). El QR es un link "…/presente?c=<code>".
--
-- El código vive en una tabla aparte (studios es de lectura pública). Solo vale
-- cerca del horario: desde 30 minutos antes hasta que termina la clase.
-- =============================================================================

create table public.studio_checkin_codes (
  studio_id uuid primary key references public.studios (id) on delete cascade,
  code text not null unique default encode(extensions.gen_random_bytes(10), 'hex'),
  rotated_at timestamptz not null default now()
);

alter table public.studio_checkin_codes enable row level security;
grant select on public.studio_checkin_codes to authenticated;
create policy studio_checkin_codes_staff_read on public.studio_checkin_codes for select to authenticated
  using (private.is_studio_staff(studio_id));

insert into public.studio_checkin_codes (studio_id) select id from public.studios;

create function private.create_checkin_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.studio_checkin_codes (studio_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger studios_checkin_code after insert on public.studios
  for each row execute function private.create_checkin_code();

-- Cambiar el QR: los carteles impresos antes dejan de valer.
create function public.rotate_checkin_code(p_studio_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('Solo la dueña o un encargado pueden cambiar el QR.', 'forbidden');
  end if;
  insert into public.studio_checkin_codes (studio_id) values (p_studio_id)
  on conflict (studio_id) do update set
    code = encode(extensions.gen_random_bytes(10), 'hex'),
    rotated_at = now()
  returning code into v_code;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- self_check_in: el alumno escaneó el cartel.
--   Sin p_session_id: si tiene UNA clase reservada (o un encuentro de su
--   formación) ahora, le da el presente. Si tiene varias → 'choose'. Si no tiene
--   reserva pero hay clases ahora → 'walk_in' (puede reservar y dar el presente).
--   Con p_session_id: da el presente en esa (reservando si hace falta).
-- Devuelve {status: checked_in | already | choose | walk_in, kind, session_id,
-- title, starts_at, options: [{kind, session_id, title, starts_at, booked}]}.
-- -----------------------------------------------------------------------------
create function public.self_check_in(
  p_code text,
  p_session_id uuid default null,
  p_role public.dance_role default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_studio_id uuid;
  v_student public.students%rowtype;
  v_options jsonb := '[]'::jsonb;
  v_booked jsonb := '[]'::jsonb;
  v_pick jsonb;
  r record;
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_booking public.bookings%rowtype;
  v_capacity integer;
  v_taken integer;
  v_role public.dance_role;
  v_pack_id uuid;
begin
  select studio_id into v_studio_id from public.studio_checkin_codes
  where code = lower(btrim(coalesce(p_code, '')));
  if v_studio_id is null then
    perform private.fail('Este QR ya no es válido: pedile el nuevo al estudio.', 'invalid_code');
  end if;
  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión para dar el presente.', 'not_authenticated');
  end if;
  if not public.studio_has_feature(v_studio_id, 'qr_checkin') then
    perform private.fail('El estudio no tiene activado el presente con QR.', 'feature_unavailable');
  end if;

  select * into v_student from public.students where studio_id = v_studio_id and user_id = v_uid;
  if not found then
    perform private.fail('Todavía no sos alumno/a de este estudio. Sumate para dar el presente.', 'not_a_student');
  end if;
  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio. Hablá con el estudio para reactivarla.', 'student_inactive');
  end if;

  -- Lo que pasa ahora: clases del estudio y encuentros de sus formaciones.
  for r in
    select 'class' as kind, s.id as session_id, o.title, s.starts_at, o.kind as offering_kind,
           b.status as booking_status, null::uuid as enrollment_id, false as attended_formation
    from public.sessions s
    join public.offerings o on o.id = s.offering_id
    left join public.bookings b
      on b.session_id = s.id and b.student_id = v_student.id and b.status in ('booked', 'attended')
    where s.studio_id = v_studio_id and s.status = 'scheduled'
      and now() between s.starts_at - interval '30 minutes' and s.ends_at
      and (p_session_id is null or s.id = p_session_id)
    union all
    select 'formation', fs.id, fs.title || ' · ' || f.title, fs.starts_at, null,
           null, e.id,
           exists (select 1 from public.formation_attendance a where a.formation_session_id = fs.id and a.enrollment_id = e.id)
    from public.formation_sessions fs
    join public.formations f on f.id = fs.formation_id
    join public.formation_enrollments e
      on e.formation_id = fs.formation_id and e.student_id = v_student.id and e.status = 'enrolled'
    where fs.studio_id = v_studio_id
      and now() between fs.starts_at - interval '30 minutes' and fs.ends_at
      and (p_session_id is null or fs.id = p_session_id)
    order by 4
  loop
    -- Clases sin reserva: solo se ofrecen las regulares.
    if r.kind = 'class' and r.booking_status is null and r.offering_kind <> 'regular' then
      continue;
    end if;
    v_pick := jsonb_build_object(
      'kind', r.kind,
      'session_id', r.session_id,
      'title', r.title,
      'starts_at', r.starts_at,
      'booked', r.kind = 'formation' or r.booking_status is not null,
      'attended', r.booking_status = 'attended' or r.attended_formation,
      'enrollment_id', r.enrollment_id
    );
    v_options := v_options || v_pick;
    if (v_pick ->> 'booked')::boolean then
      v_booked := v_booked || v_pick;
    end if;
  end loop;

  if jsonb_array_length(v_options) = 0 then
    if p_session_id is not null then
      perform private.fail('Esa clase no está en horario para dar el presente.', 'outside_window');
    end if;
    perform private.fail('No tenés una clase ahora. El presente se da desde 30 minutos antes de que empiece.', 'no_session_now');
  end if;

  if p_session_id is null then
    if jsonb_array_length(v_booked) > 1 then
      return jsonb_build_object('status', 'choose', 'options', v_booked);
    end if;
    if jsonb_array_length(v_booked) = 0 then
      return jsonb_build_object('status', 'walk_in', 'options', v_options);
    end if;
    v_pick := v_booked -> 0;
  else
    v_pick := v_options -> 0;
  end if;

  if (v_pick ->> 'attended')::boolean then
    return v_pick || jsonb_build_object('status', 'already');
  end if;

  -- Encuentro de formación: bloquea si debe una cuota.
  if v_pick ->> 'kind' = 'formation' then
    if private.enrollment_in_debt((v_pick ->> 'enrollment_id')::uuid) then
      perform private.fail('Tenés una cuota vencida de la formación. Pagala para dar el presente.', 'in_debt');
    end if;
    insert into public.formation_attendance (studio_id, formation_session_id, enrollment_id, checked_in_by)
    values (v_studio_id, (v_pick ->> 'session_id')::uuid, (v_pick ->> 'enrollment_id')::uuid, v_uid)
    on conflict (formation_session_id, enrollment_id) do nothing;
    return v_pick || jsonb_build_object('status', 'checked_in');
  end if;

  select * into v_session from public.sessions where id = (v_pick ->> 'session_id')::uuid for update;

  -- Clase reservada.
  if (v_pick ->> 'booked')::boolean then
    update public.bookings set status = 'attended', checked_in_at = now()
    where session_id = v_session.id and student_id = v_student.id and status = 'booked';
    return v_pick || jsonb_build_object('status', 'checked_in');
  end if;

  -- Sin reserva y todavía no empezó: se reserva con las reglas de siempre.
  if v_session.starts_at > now() then
    v_booking := public.book_session(v_session.id, p_role);
    update public.bookings set status = 'attended', checked_in_at = now() where id = v_booking.id;
    return v_pick || jsonb_build_object('status', 'checked_in', 'booked', true);
  end if;

  -- Sin reserva y ya empezó: entra si hay lugar y tiene saldo.
  select * into v_offering from public.offerings where id = v_session.offering_id;
  select count(*)::integer into v_taken from public.bookings
  where session_id = v_session.id and status in ('booked', 'attended');
  v_capacity := coalesce(v_session.capacity_override, v_offering.capacity);
  if v_taken >= v_capacity then
    perform private.fail('La clase está completa.', 'session_full');
  end if;

  if private.discipline_has(v_offering.discipline_key, 'role_balance') then
    v_role := coalesce(p_role, v_student.default_role);
    if v_role is null then
      perform private.fail('Elegí si vas como líder o seguidor/a.', 'role_required');
    end if;
  end if;

  v_pack_id := private.take_credit(v_studio_id, v_student.id, v_session.starts_at);
  if v_pack_id is null then
    perform private.fail('No tenés clases disponibles. Comprá un pack.', 'no_credits');
  end if;

  insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role, status, checked_in_at, created_by)
  values (v_studio_id, v_session.id, v_student.id, v_pack_id, v_role, 'attended', now(), v_uid)
  returning * into v_booking;

  insert into public.pack_credit_events (studio_id, student_pack_id, booking_id, kind, delta, note, created_by)
  values (v_studio_id, v_pack_id, v_booking.id, 'consume', -1, 'Presente con el QR del estudio', v_uid);

  return v_pick || jsonb_build_object('status', 'checked_in', 'booked', true);
end;
$$;

grant execute on function public.rotate_checkin_code(uuid) to authenticated, service_role;
grant execute on function public.self_check_in(text, uuid, public.dance_role) to authenticated, service_role;
