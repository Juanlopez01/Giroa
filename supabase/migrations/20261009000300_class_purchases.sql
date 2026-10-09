-- =============================================================================
-- Clases sueltas y workshops: pagar una clase puntual sin pack.
--   · Clase suelta (feature 'drop_in'): una clase regular con precio suelto
--     (offerings.price_cents). El alumno sin saldo la reserva y la paga.
--   · Workshop / seminario (feature 'specials'): una clase especial (kind
--     'special') con su precio; pack_allowed dice si también vale con pack.
-- El pago online reserva el lugar 20 minutos (como las entradas): se crea la
-- reserva y una compra pendiente; si no se paga, vence y se libera el lugar.
-- MP: external_reference = "clase:<uuid>". También se cobra en el mostrador.
-- =============================================================================

insert into public.plan_features (plan, feature) values ('estudio', 'drop_in'), ('pro', 'drop_in')
on conflict do nothing;

alter table public.offerings add column pack_allowed boolean not null default true;
comment on column public.offerings.price_cents is
  'Regular: precio de la clase suelta (null = no se vende suelta). Special: precio del workshop.';

create table public.class_purchases (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  session_id uuid not null,
  student_id uuid not null,
  booking_id uuid,
  amount_cents bigint not null check (amount_cents > 0),
  method public.payment_method,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled', 'refunded')),
  hold_expires_at timestamptz,
  external_reference uuid not null unique default gen_random_uuid(),
  mp_preference_id text,
  mp_payment_id text unique,
  paid_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  foreign key (studio_id, session_id) references public.sessions (studio_id, id) on delete restrict,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete restrict,
  foreign key (studio_id, booking_id) references public.bookings (studio_id, id) on delete set null (booking_id)
);

create index class_purchases_session_idx on public.class_purchases (session_id);
create index class_purchases_pending_idx on public.class_purchases (hold_expires_at) where status = 'pending';

create trigger class_purchases_updated_at before update on public.class_purchases
  for each row execute function private.set_updated_at();

alter table public.class_purchases enable row level security;
revoke all on public.class_purchases from anon, authenticated;
grant select on public.class_purchases to authenticated;
create policy class_purchases_read on public.class_purchases for select to authenticated
  using (private.is_studio_staff(studio_id) or student_id in (select private.my_student_ids()));

-- Si el alumno cancela la reserva antes de pagar, la compra pendiente se anula.
create function private.cancel_pending_class_purchase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.class_purchases set status = 'cancelled'
  where booking_id = new.id and status = 'pending';
  return null;
end;
$$;
revoke execute on function private.cancel_pending_class_purchase() from public, anon, authenticated;

create trigger bookings_cancel_pending_purchase
  after update of status on public.bookings
  for each row
  when (old.status = 'booked' and new.status = 'cancelled')
  execute function private.cancel_pending_class_purchase();

-- -----------------------------------------------------------------------------
-- Validación común de una reserva: clase vigente y por empezar, sin reserva
-- previa, con cupo y con el balance de roles. Devuelve el rol a guardar.
-- -----------------------------------------------------------------------------
create function private.booking_role(
  p_session public.sessions,
  p_offering public.offerings,
  p_student public.students,
  p_role public.dance_role
)
returns public.dance_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_taken integer;
  v_leaders integer;
  v_followers integer;
  v_same integer;
  v_other integer;
  v_role public.dance_role;
begin
  if p_session.status <> 'scheduled' then
    perform private.fail('Esta clase fue cancelada.', 'session_cancelled');
  end if;
  if p_session.starts_at <= now() then
    perform private.fail('Esta clase ya empezó.', 'session_started');
  end if;
  if exists (
    select 1 from public.bookings b
    where b.session_id = p_session.id and b.student_id = p_student.id and b.status in ('booked', 'attended')
  ) then
    perform private.fail('Ya tenés lugar en esta clase.', 'already_booked');
  end if;

  select
    count(*)::integer,
    count(*) filter (where b.dance_role = 'leader')::integer,
    count(*) filter (where b.dance_role = 'follower')::integer
  into v_taken, v_leaders, v_followers
  from public.bookings b
  where b.session_id = p_session.id and b.status in ('booked', 'attended');

  v_capacity := coalesce(p_session.capacity_override, p_offering.capacity);
  if v_taken >= v_capacity then
    perform private.fail('La clase está completa.', 'session_full');
  end if;

  if private.discipline_has(p_offering.discipline_key, 'role_balance') then
    v_role := coalesce(p_role, p_student.default_role);
    if v_role is null then
      perform private.fail('Elegí si vas como líder o seguidor/a.', 'role_required');
    end if;
    if p_offering.role_balance_max_diff is not null then
      v_same := case when v_role = 'leader' then v_leaders else v_followers end;
      v_other := case when v_role = 'leader' then v_followers else v_leaders end;
      if (v_same + 1) - v_other > p_offering.role_balance_max_diff then
        perform private.fail(
          format(
            'Por ahora no hay lugar como %s: faltan %s para mantener el balance de la clase. Probá más tarde.',
            private.role_label(v_role),
            private.role_label(case when v_role = 'leader' then 'follower'::public.dance_role else 'leader'::public.dance_role end, true)
          ),
          'role_unbalanced'
        );
      end if;
    end if;
  end if;
  return v_role;
end;
$$;
revoke execute on function private.booking_role(public.sessions, public.offerings, public.students, public.dance_role)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- book_session (con pack o clase de prueba): igual que antes, con la
-- validación común, y ahora también para workshops que aceptan pack.
-- -----------------------------------------------------------------------------
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
  v_pack_id := private.take_credit(v_session.studio_id, v_student.id, v_session.starts_at);
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

-- ¿Esta clase se vende suelta? Devuelve el precio o falla con un mensaje claro.
create function private.class_sale_price(p_offering public.offerings)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not p_offering.is_active or p_offering.kind = 'formation' or p_offering.price_cents is null or p_offering.price_cents <= 0 then
    perform private.fail('Esta clase no se vende suelta.', 'not_for_sale');
  end if;
  if p_offering.kind = 'special' and not public.studio_has_feature(p_offering.studio_id, 'specials') then
    perform private.fail('Los workshops están en el plan Estudio.', 'feature_unavailable');
  end if;
  if p_offering.kind = 'regular' and not public.studio_has_feature(p_offering.studio_id, 'drop_in') then
    perform private.fail('Las clases sueltas están en el plan Estudio.', 'feature_unavailable');
  end if;
  return p_offering.price_cents;
end;
$$;
revoke execute on function private.class_sale_price(public.offerings) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- book_session_paid: el alumno reserva una clase suelta o un workshop para
-- pagarlo online. Se guarda el lugar 20 minutos. Si ya tiene una compra
-- pendiente vigente para esa clase, la devuelve (reintentar el pago).
-- -----------------------------------------------------------------------------
create function public.book_session_paid(p_session_id uuid, p_role public.dance_role default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_student public.students%rowtype;
  v_price bigint;
  v_role public.dance_role;
  v_booking public.bookings%rowtype;
  v_purchase public.class_purchases%rowtype;
begin
  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión para reservar.', 'not_authenticated');
  end if;
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;
  select * into v_offering from public.offerings where id = v_session.offering_id;
  select * into v_student from public.students where studio_id = v_session.studio_id and user_id = v_uid;
  if not found then
    perform private.fail('Todavía no sos alumno/a de este estudio. Sumate para reservar.', 'not_a_student');
  end if;
  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio. Hablá con el estudio para reactivarla.', 'student_inactive');
  end if;

  select * into v_purchase from public.class_purchases
  where session_id = v_session.id and student_id = v_student.id and status = 'pending' and hold_expires_at > now()
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('purchase_id', v_purchase.id, 'external_reference', v_purchase.external_reference,
      'amount_cents', v_purchase.amount_cents, 'hold_expires_at', v_purchase.hold_expires_at);
  end if;

  v_price := private.class_sale_price(v_offering);
  v_role := private.booking_role(v_session, v_offering, v_student, p_role);

  insert into public.bookings (studio_id, session_id, student_id, dance_role, created_by)
  values (v_session.studio_id, v_session.id, v_student.id, v_role, v_uid)
  returning * into v_booking;

  insert into public.class_purchases (studio_id, session_id, student_id, booking_id, amount_cents, hold_expires_at, created_by)
  values (v_session.studio_id, v_session.id, v_student.id, v_booking.id, v_price, now() + interval '20 minutes', v_uid)
  returning * into v_purchase;

  return jsonb_build_object('purchase_id', v_purchase.id, 'external_reference', v_purchase.external_reference,
    'amount_cents', v_purchase.amount_cents, 'hold_expires_at', v_purchase.hold_expires_at);
end;
$$;

-- Vuelve a dar el lugar a una compra pagada cuya reserva se había liberado.
create function private.reinstate_class_booking(p_purchase public.class_purchases)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_taken integer;
begin
  if p_purchase.booking_id is not null and exists (
    select 1 from public.bookings where id = p_purchase.booking_id and status in ('booked', 'attended')
  ) then
    return true;
  end if;
  select * into v_session from public.sessions where id = p_purchase.session_id for update;
  select * into v_offering from public.offerings where id = v_session.offering_id;
  select count(*)::integer into v_taken from public.bookings
  where session_id = v_session.id and status in ('booked', 'attended');
  if v_session.status <> 'scheduled' or v_taken >= coalesce(v_session.capacity_override, v_offering.capacity) then
    return false;
  end if;
  begin
    update public.bookings set status = 'booked', cancelled_at = null where id = p_purchase.booking_id;
  exception when unique_violation then
    return true; -- ya tiene otra reserva activa en esa clase
  end;
  return found;
end;
$$;
revoke execute on function private.reinstate_class_booking(public.class_purchases) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- mp_apply_class_payment: lo llama el webhook (service role) o la vuelta de MP.
-- -----------------------------------------------------------------------------
create function public.mp_apply_class_payment(
  p_external_reference uuid,
  p_mp_payment_id text,
  p_mp_status text,
  p_amount_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.class_purchases%rowtype;
  v_spot boolean;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;
  select * into v_p from public.class_purchases where external_reference = p_external_reference for update;
  if not found then
    perform private.fail('No encontramos esa compra.', 'purchase_not_found');
  end if;

  if v_p.status = 'paid' and v_p.mp_payment_id is distinct from p_mp_payment_id then
    return jsonb_build_object('purchase_id', v_p.id, 'status', v_p.status, 'ignored', 'already_paid');
  end if;

  if p_mp_status = 'approved' then
    if p_amount_cents is distinct from v_p.amount_cents then
      update public.class_purchases set notes = concat_ws(E'\n', notes,
        format('MP %s aprobado por %s centavos (esperado %s): revisar.', p_mp_payment_id, p_amount_cents, v_p.amount_cents))
      where id = v_p.id;
      return jsonb_build_object('purchase_id', v_p.id, 'status', v_p.status, 'ignored', 'amount_mismatch');
    end if;
    if v_p.status <> 'paid' then
      v_spot := private.reinstate_class_booking(v_p);
      update public.class_purchases set
        status = 'paid', method = 'mercadopago', mp_payment_id = p_mp_payment_id, paid_at = now(),
        notes = case when v_spot then notes
                     else concat_ws(E'\n', notes, 'Pagó después de que se liberó el lugar y la clase ya no tiene cupo: devolvele el pago.') end
      where id = v_p.id;
    end if;
    return jsonb_build_object('purchase_id', v_p.id, 'status', 'paid');
  end if;

  if p_mp_status in ('refunded', 'charged_back') then
    update public.class_purchases set status = 'refunded' where id = v_p.id;
    update public.bookings set status = 'cancelled', cancelled_at = now()
    where id = v_p.booking_id and status = 'booked';
    return jsonb_build_object('purchase_id', v_p.id, 'status', 'refunded');
  end if;

  -- Rechazado o en proceso: queda como estaba (puede reintentar mientras dure la reserva).
  return jsonb_build_object('purchase_id', v_p.id, 'status', v_p.status);
end;
$$;

-- El staff registra que una compra pendiente se pagó en efectivo o transferencia.
create function public.record_class_payment(p_purchase_id uuid, p_method public.payment_method)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.class_purchases%rowtype;
  v_spot boolean;
begin
  select * into v_p from public.class_purchases where id = p_purchase_id for update;
  if not found or not (private.is_privileged() or private.can_take_payments(v_p.studio_id)) then
    perform private.fail('No encontramos esa compra.', 'purchase_not_found');
  end if;
  if p_method not in ('cash', 'transfer') then
    perform private.fail('Elegí efectivo o transferencia.', 'invalid_method');
  end if;
  if v_p.status = 'paid' then
    return jsonb_build_object('purchase_id', v_p.id, 'status', 'paid');
  end if;
  if v_p.status not in ('pending', 'expired') then
    perform private.fail('Esta compra fue anulada.', 'purchase_closed');
  end if;
  v_spot := private.reinstate_class_booking(v_p);
  if not v_spot then
    perform private.fail('La clase ya no tiene lugar.', 'session_full');
  end if;
  update public.class_purchases set status = 'paid', method = p_method, paid_at = now() where id = v_p.id;
  return jsonb_build_object('purchase_id', v_p.id, 'status', 'paid');
end;
$$;

-- El staff vende una clase suelta o un workshop en el mostrador (queda pago).
create function public.sell_class_manual(
  p_session_id uuid,
  p_student_id uuid,
  p_method public.payment_method,
  p_role public.dance_role default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_student public.students%rowtype;
  v_price bigint;
  v_role public.dance_role;
  v_booking public.bookings%rowtype;
  v_purchase public.class_purchases%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or not (private.is_privileged() or private.can_take_payments(v_session.studio_id)) then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;
  if p_method not in ('cash', 'transfer') then
    perform private.fail('Elegí efectivo o transferencia.', 'invalid_method');
  end if;
  select * into v_offering from public.offerings where id = v_session.offering_id;
  select * into v_student from public.students where id = p_student_id and studio_id = v_session.studio_id;
  if not found then
    perform private.fail('No encontramos a ese alumno en el estudio.', 'student_not_found');
  end if;

  v_price := private.class_sale_price(v_offering);
  v_role := private.booking_role(v_session, v_offering, v_student, p_role);

  insert into public.bookings (studio_id, session_id, student_id, dance_role, created_by)
  values (v_session.studio_id, v_session.id, v_student.id, v_role, auth.uid())
  returning * into v_booking;
  insert into public.class_purchases (studio_id, session_id, student_id, booking_id, amount_cents, method, status, paid_at, created_by)
  values (v_session.studio_id, v_session.id, v_student.id, v_booking.id, v_price, p_method, 'paid', now(), auth.uid())
  returning * into v_purchase;

  return jsonb_build_object('purchase_id', v_purchase.id, 'booking_id', v_booking.id, 'status', 'paid');
end;
$$;

-- Vencen las reservas sin pagar y se libera el lugar (cron cada 5 minutos).
create function public.expire_class_purchases()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;
  for r in
    select id, booking_id from public.class_purchases
    where status = 'pending' and hold_expires_at <= now()
    for update skip locked
  loop
    update public.class_purchases set status = 'expired' where id = r.id;
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = r.booking_id and status = 'booked';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

select cron.schedule('giroa_expire_class_purchases', '*/5 * * * *', $$select public.expire_class_purchases()$$);

-- -----------------------------------------------------------------------------
-- La grilla pública ahora incluye los workshops, con su precio.
-- -----------------------------------------------------------------------------
drop function public.list_public_sessions(text, timestamptz, timestamptz);

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
  role_balance_max_diff smallint,
  kind public.offering_kind,
  price_cents bigint,
  pack_allowed boolean
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
    o.role_balance_max_diff,
    o.kind,
    -- El precio suelto solo se muestra si el plan lo incluye.
    case
      when o.kind = 'special' and public.studio_has_feature(st.id, 'specials') then o.price_cents
      when o.kind = 'regular' and public.studio_has_feature(st.id, 'drop_in') then o.price_cents
    end,
    o.pack_allowed
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
    and (o.kind = 'regular' or (o.kind = 'special' and public.studio_has_feature(st.id, 'specials')))
    and s.starts_at >= p_from
    and s.starts_at < p_to
  order by s.starts_at, o.title;
end;
$$;

grant execute on function public.list_public_sessions(text, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.book_session_paid(uuid, public.dance_role) to authenticated, service_role;
grant execute on function public.mp_apply_class_payment(uuid, text, text, bigint) to service_role;
grant execute on function public.record_class_payment(uuid, public.payment_method) to authenticated, service_role;
grant execute on function public.sell_class_manual(uuid, uuid, public.payment_method, public.dance_role) to authenticated, service_role;
grant execute on function public.expire_class_purchases() to service_role;
