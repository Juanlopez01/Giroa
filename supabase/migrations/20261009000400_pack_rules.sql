-- =============================================================================
-- Packs con restricciones (feature 'pack_rules', planes Estudio y Pro):
-- "Solo yoga", "Lunes a viernes", "Antes de las 17".
--
-- pack_products.rules (jsonb) se copia al pack del alumno cuando se crea, así
-- un cambio posterior en el producto no afecta packs ya vendidos:
--   { "disciplines": ["yoga"],          -- solo estas disciplinas…
--     "offerings":   ["<uuid>"],        -- …o estas clases (vale si coincide alguna)
--     "weekdays":    [1,2,3,4,5],       -- 0 = domingo … 6 = sábado (hora del estudio)
--     "from": "08:00", "until": "17:00" -- la clase empieza en [from, until)
--   }
-- {} = sin restricciones. Al reservar se usa el pack que sirve para esa clase y
-- vence antes; si ninguno sirve, se avisa cuál no vale.
-- =============================================================================

insert into public.plan_features (plan, feature) values ('estudio', 'pack_rules'), ('pro', 'pack_rules')
on conflict do nothing;

alter table public.pack_products
  add column rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object');
alter table public.student_packs
  add column rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object');

-- El pack del alumno hereda las restricciones del producto al crearse.
create function private.copy_pack_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pack_product_id is not null and new.rules = '{}'::jsonb then
    select coalesce(p.rules, '{}'::jsonb) into new.rules from public.pack_products p where p.id = new.pack_product_id;
    new.rules := coalesce(new.rules, '{}'::jsonb);
  end if;
  return new;
end;
$$;
revoke execute on function private.copy_pack_rules() from public, anon, authenticated;

create trigger student_packs_copy_rules before insert on public.student_packs
  for each row execute function private.copy_pack_rules();

-- ¿El pack vale para esta clase?
create function private.pack_rules_allow(p_rules jsonb, p_session public.sessions, p_offering public.offerings, p_tz text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_session.starts_at at time zone p_tz;
  v_lists boolean;
begin
  if p_rules is null or p_rules = '{}'::jsonb then
    return true;
  end if;

  v_lists := coalesce(jsonb_array_length(p_rules -> 'disciplines'), 0) > 0
          or coalesce(jsonb_array_length(p_rules -> 'offerings'), 0) > 0;
  if v_lists and not (
    coalesce((p_rules -> 'disciplines') ? p_offering.discipline_key, false)
    or coalesce((p_rules -> 'offerings') ? p_offering.id::text, false)
  ) then
    return false;
  end if;

  if coalesce(jsonb_array_length(p_rules -> 'weekdays'), 0) > 0
     and not (p_rules -> 'weekdays') @> to_jsonb(extract(dow from v_local)::int) then
    return false;
  end if;

  if p_rules ? 'from' and v_local::time < (p_rules ->> 'from')::time then
    return false;
  end if;
  if p_rules ? 'until' and v_local::time >= (p_rules ->> 'until')::time then
    return false;
  end if;
  return true;
end;
$$;
revoke execute on function private.pack_rules_allow(jsonb, public.sessions, public.offerings, text) from public, anon, authenticated;

-- Toma un crédito del pack usable que sirve para la clase y vence primero.
-- Si tiene packs con saldo pero ninguno vale para esta clase, lo avisa.
create function private.take_credit_for_session(p_session_id uuid, p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_tz text;
  v_pack_id uuid;
  v_other text;
begin
  select * into v_session from public.sessions where id = p_session_id;
  select * into v_offering from public.offerings where id = v_session.offering_id;
  select timezone into v_tz from public.studios where id = v_session.studio_id;

  select sp.id into v_pack_id
  from public.student_packs sp
  where sp.studio_id = v_session.studio_id
    and (sp.student_id = p_student_id or sp.partner_student_id = p_student_id)
    and sp.status = 'active'
    and sp.expires_at > v_session.starts_at
    and (sp.credits_total is null or sp.credits_used < sp.credits_total)
    and private.pack_rules_allow(sp.rules, v_session, v_offering, v_tz)
  order by sp.expires_at, sp.created_at
  limit 1
  for update;

  if v_pack_id is not null then
    update public.student_packs set credits_used = credits_used + 1 where id = v_pack_id;
    return v_pack_id;
  end if;

  select sp.name into v_other
  from public.student_packs sp
  where sp.studio_id = v_session.studio_id
    and (sp.student_id = p_student_id or sp.partner_student_id = p_student_id)
    and sp.status = 'active'
    and sp.expires_at > v_session.starts_at
    and (sp.credits_total is null or sp.credits_used < sp.credits_total)
  order by sp.expires_at
  limit 1;
  if v_other is not null then
    perform private.fail(format('El pack «%s» no vale para esta clase.', v_other), 'pack_not_valid');
  end if;
  return null;
end;
$$;
revoke execute on function private.take_credit_for_session(uuid, uuid) from public, anon, authenticated;

-- book_session: igual que antes, pero el crédito se toma con las restricciones del pack.
create or replace function public.book_session(
  p_session_id uuid,
  p_role public.dance_role default null,
  p_student_id uuid default null,
  p_trial boolean default false
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_student public.students%rowtype;
  v_is_staff boolean;
  v_role public.dance_role;
  v_pack_id uuid;
  v_booking public.bookings%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;

  select * into v_offering from public.offerings where id = v_session.offering_id;
  v_is_staff := private.is_privileged() or private.is_studio_staff(v_session.studio_id);

  -- Quién reserva.
  if p_student_id is not null then
    if not v_is_staff then
      perform private.fail('No podés anotar a otra persona.', 'forbidden');
    end if;
    select * into v_student from public.students
    where id = p_student_id and studio_id = v_session.studio_id;
    if not found then
      perform private.fail('No encontramos a ese alumno en el estudio.', 'student_not_found');
    end if;
  else
    if v_uid is null then
      perform private.fail('Tenés que iniciar sesión para reservar.', 'not_authenticated');
    end if;
    select * into v_student from public.students
    where studio_id = v_session.studio_id and user_id = v_uid;
    if not found then
      perform private.fail('Todavía no sos alumno/a de este estudio. Sumate para reservar.', 'not_a_student');
    end if;
  end if;

  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio. Hablá con el estudio para reactivarla.', 'student_inactive');
  end if;

  -- Con pack: clases regulares y los workshops que lo permiten. La prueba, solo regulares.
  if v_session.status = 'scheduled' and (
    not v_offering.is_active
    or v_offering.kind = 'formation'
    or (v_offering.kind = 'special' and (not v_offering.pack_allowed or coalesce(p_trial, false)))
  ) then
    if v_offering.kind = 'special' and v_offering.price_cents is not null then
      perform private.fail('Este workshop se paga aparte: reservalo pagándolo.', 'pay_required');
    end if;
    perform private.fail('Esta clase no admite reservas.', 'not_bookable');
  end if;

  if coalesce(p_trial, false) and not private.trial_available(v_session.studio_id, v_student.id) then
    perform private.fail('La clase de prueba ya no está disponible. Comprá un pack para reservar.', 'trial_not_available');
  end if;

  v_role := private.booking_role(v_session, v_offering, v_student, p_role);

  -- Clase de prueba: sin saldo.
  if coalesce(p_trial, false) then
    insert into public.bookings (studio_id, session_id, student_id, dance_role, is_trial, created_by)
    values (v_session.studio_id, v_session.id, v_student.id, v_role, true, v_uid)
    returning * into v_booking;
    return v_booking;
  end if;

  -- Saldo: consume el pack que vence primero.
  v_pack_id := private.take_credit_for_session(v_session.id, v_student.id);
  if v_pack_id is null then
    if p_student_id is not null then
      perform private.fail('Este alumno no tiene clases disponibles. Cargale un pack.', 'no_credits');
    else
      perform private.fail('No tenés clases disponibles. Comprá un pack.', 'no_credits');
    end if;
  end if;

  insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role, created_by)
  values (v_session.studio_id, v_session.id, v_student.id, v_pack_id, v_role, v_uid)
  returning * into v_booking;

  insert into public.pack_credit_events (studio_id, student_pack_id, booking_id, kind, delta, created_by)
  values (v_session.studio_id, v_pack_id, v_booking.id, 'consume', -1, v_uid);

  return v_booking;
end;
$$;

-- check_in: igual que antes, pero el crédito se toma con las restricciones del pack.
create or replace function public.check_in(p_session_id uuid, p_student_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_student public.students%rowtype;
  v_booking public.bookings%rowtype;
  v_pack_id uuid;
  v_role public.dance_role;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;

  if not (private.is_privileged() or private.is_studio_staff(v_session.studio_id)) then
    perform private.fail('Solo el staff del estudio puede tomar asistencia.', 'forbidden');
  end if;

  if v_session.status <> 'scheduled' then
    perform private.fail('Esta clase fue cancelada.', 'session_cancelled');
  end if;
  if now() < v_session.starts_at - interval '2 hours' then
    perform private.fail('Todavía es temprano para tomar asistencia de esta clase.', 'too_early');
  end if;

  select * into v_student from public.students
  where id = p_student_id and studio_id = v_session.studio_id;
  if not found then
    perform private.fail('No encontramos a ese alumno en el estudio.', 'student_not_found');
  end if;

  -- Tenía reserva.
  select * into v_booking from public.bookings
  where session_id = v_session.id and student_id = v_student.id and status in ('booked', 'attended')
  for update;

  if found then
    if v_booking.status = 'attended' then
      return v_booking;
    end if;
    update public.bookings set status = 'attended', checked_in_at = now()
    where id = v_booking.id
    returning * into v_booking;
    return v_booking;
  end if;

  -- Llegó sin reserva.
  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio.', 'student_inactive');
  end if;

  select * into v_offering from public.offerings where id = v_session.offering_id;
  if private.discipline_has(v_offering.discipline_key, 'role_balance') then
    v_role := v_student.default_role;
  end if;

  v_pack_id := private.take_credit_for_session(v_session.id, v_student.id);
  if v_pack_id is null then
    perform private.fail(
      format('%s no tiene clases disponibles. Cargale un pack o registrá un pago.', v_student.full_name),
      'no_credits'
    );
  end if;

  insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role, status, checked_in_at, created_by)
  values (v_session.studio_id, v_session.id, v_student.id, v_pack_id, v_role, 'attended', now(), v_uid)
  returning * into v_booking;

  insert into public.pack_credit_events (studio_id, student_pack_id, booking_id, kind, delta, note, created_by)
  values (v_session.studio_id, v_pack_id, v_booking.id, 'consume', -1, 'Check-in sin reserva', v_uid);

  return v_booking;
end;
$$;

-- self_check_in: igual que antes, pero el crédito se toma con las restricciones del pack.
create or replace function public.self_check_in(
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

  v_pack_id := private.take_credit_for_session(v_session.id, v_student.id);
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
