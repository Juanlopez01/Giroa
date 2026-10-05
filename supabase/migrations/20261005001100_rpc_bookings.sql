-- =============================================================================
-- Reservas, cancelaciones y asistencia. Todo en una transacción con lock sobre
-- la sesión (serializa las reservas de una misma clase) y sobre el pack.
-- =============================================================================

create function private.role_label(p_role public.dance_role, p_plural boolean default false)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_role = 'leader' and not p_plural then 'líder'
    when p_role = 'leader' then 'líderes'
    when not p_plural then 'seguidor/a'
    else 'seguidores/as'
  end
$$;

create function private.discipline_has(p_discipline_key text, p_feature text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select (d.features ->> p_feature)::boolean from public.disciplines d where d.key = p_discipline_key),
    false
  )
$$;

-- Toma un crédito del pack usable que vence primero (propio o de pareja) y lo
-- bloquea. Devuelve null si no hay saldo.
create function private.take_credit(p_studio_id uuid, p_student_id uuid, p_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack_id uuid;
begin
  select sp.id into v_pack_id
  from public.student_packs sp
  where sp.studio_id = p_studio_id
    and (sp.student_id = p_student_id or sp.partner_student_id = p_student_id)
    and sp.status = 'active'
    and sp.expires_at > p_at
    and (sp.credits_total is null or sp.credits_used < sp.credits_total)
  order by sp.expires_at, sp.created_at
  limit 1
  for update;

  if v_pack_id is not null then
    update public.student_packs set credits_used = credits_used + 1 where id = v_pack_id;
  end if;

  return v_pack_id;
end;
$$;

-- Devuelve un crédito al pack de la reserva.
create function private.refund_credit(p_booking public.bookings, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_booking.student_pack_id is null then
    return;
  end if;

  update public.student_packs
  set credits_used = greatest(credits_used - 1, 0)
  where id = p_booking.student_pack_id;

  insert into public.pack_credit_events (studio_id, student_pack_id, booking_id, kind, delta, note, created_by)
  values (p_booking.studio_id, p_booking.student_pack_id, p_booking.id, 'refund', 1, p_note, auth.uid());
end;
$$;

revoke execute on function private.take_credit(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.refund_credit(public.bookings, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- book_session: el alumno reserva (o el staff anota a un alumno con p_student_id).
-- -----------------------------------------------------------------------------
create function public.book_session(
  p_session_id uuid,
  p_role public.dance_role default null,
  p_student_id uuid default null
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
  v_capacity integer;
  v_taken integer;
  v_leaders integer;
  v_followers integer;
  v_same integer;
  v_other integer;
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

  -- La clase.
  if v_session.status <> 'scheduled' then
    perform private.fail('Esta clase fue cancelada.', 'session_cancelled');
  end if;
  if v_session.starts_at <= now() then
    perform private.fail('Esta clase ya empezó.', 'session_started');
  end if;
  if not v_offering.is_active or v_offering.kind <> 'regular' then
    perform private.fail('Esta clase no admite reservas.', 'not_bookable');
  end if;

  if exists (
    select 1 from public.bookings b
    where b.session_id = v_session.id and b.student_id = v_student.id
      and b.status in ('booked', 'attended')
  ) then
    perform private.fail('Ya tenés lugar en esta clase.', 'already_booked');
  end if;

  -- Cupo.
  select
    count(*)::integer,
    count(*) filter (where b.dance_role = 'leader')::integer,
    count(*) filter (where b.dance_role = 'follower')::integer
  into v_taken, v_leaders, v_followers
  from public.bookings b
  where b.session_id = v_session.id and b.status in ('booked', 'attended');

  v_capacity := coalesce(v_session.capacity_override, v_offering.capacity);
  if v_taken >= v_capacity then
    perform private.fail('La clase está completa.', 'session_full');
  end if;

  -- Balance de roles (solo disciplinas con el flag).
  if private.discipline_has(v_offering.discipline_key, 'role_balance') then
    v_role := coalesce(p_role, v_student.default_role);
    if v_role is null then
      perform private.fail('Elegí si vas como líder o seguidor/a.', 'role_required');
    end if;

    if v_offering.role_balance_max_diff is not null then
      v_same := case when v_role = 'leader' then v_leaders else v_followers end;
      v_other := case when v_role = 'leader' then v_followers else v_leaders end;
      if (v_same + 1) - v_other > v_offering.role_balance_max_diff then
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
  else
    v_role := null;
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

-- -----------------------------------------------------------------------------
-- cancel_booking: si el alumno cancela antes de la ventana del estudio, se le
-- devuelve la clase. El staff decide (por defecto devuelve).
-- -----------------------------------------------------------------------------
create function public.cancel_booking(
  p_booking_id uuid,
  p_refund boolean default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_session public.sessions%rowtype;
  v_window_hours smallint;
  v_is_staff boolean;
  v_refund boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    perform private.fail('No encontramos esa reserva.', 'booking_not_found');
  end if;

  v_is_staff := private.is_privileged() or private.is_studio_staff(v_booking.studio_id);

  if not v_is_staff and not exists (
    select 1 from public.students s where s.id = v_booking.student_id and s.user_id = v_uid
  ) then
    -- Mismo mensaje que si no existiera: no revela reservas ajenas.
    perform private.fail('No encontramos esa reserva.', 'booking_not_found');
  end if;

  if v_booking.status <> 'booked' then
    perform private.fail('Esta reserva ya no está activa.', 'booking_not_active');
  end if;

  select * into v_session from public.sessions where id = v_booking.session_id;
  select cancel_window_hours into v_window_hours from public.studios where id = v_booking.studio_id;

  if v_is_staff then
    v_refund := coalesce(p_refund, true);
  else
    if v_session.starts_at <= now() then
      perform private.fail('La clase ya empezó: ya no se puede cancelar.', 'session_started');
    end if;
    v_refund := v_session.starts_at - now() >= make_interval(hours => v_window_hours);
  end if;

  update public.bookings set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_uid,
    credit_refunded = v_refund
  where id = v_booking.id
  returning * into v_booking;

  if v_refund then
    perform private.refund_credit(v_booking, 'Cancelación');
  end if;

  return v_booking;
end;
$$;

-- -----------------------------------------------------------------------------
-- check_in: solo staff. Marca presente; si no tenía reserva, consume saldo y lo
-- marca presente igual (el staff decide si entra aunque la clase esté llena).
-- -----------------------------------------------------------------------------
create function public.check_in(p_session_id uuid, p_student_id uuid)
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

  v_pack_id := private.take_credit(v_session.studio_id, v_student.id, v_session.starts_at);
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

-- Check-in escaneando el QR del alumno. Devuelve lo que la pantalla del staff
-- necesita mostrar: nombre, si vino sin reserva y cómo le quedó el saldo.
create function public.check_in_by_qr(p_session_id uuid, p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio_id uuid;
  v_student public.students%rowtype;
  v_had_booking boolean;
  v_booking public.bookings%rowtype;
  v_balance public.student_balances%rowtype;
begin
  select studio_id into v_studio_id from public.sessions where id = p_session_id;
  if v_studio_id is null then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;
  if not (private.is_privileged() or private.is_studio_staff(v_studio_id)) then
    perform private.fail('Solo el staff del estudio puede tomar asistencia.', 'forbidden');
  end if;

  select * into v_student from public.students
  where qr_token = p_qr_token and studio_id = v_studio_id;
  if not found then
    perform private.fail('Este QR no corresponde a ningún alumno del estudio.', 'qr_not_found');
  end if;

  v_had_booking := exists (
    select 1 from public.bookings
    where session_id = p_session_id and student_id = v_student.id and status in ('booked', 'attended')
  );

  v_booking := public.check_in(p_session_id, v_student.id);

  if v_booking.student_pack_id is not null then
    select * into v_balance from public.student_balances where student_pack_id = v_booking.student_pack_id;
  end if;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'student_id', v_student.id,
    'student_name', v_student.full_name,
    'walk_in', not v_had_booking,
    'credits_remaining', v_balance.credits_remaining,
    'expires_on', v_balance.expires_on
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- cancel_session: owner/admin cancela una clase; se cancelan las reservas con
-- devolución y se avisa a los alumnos.
-- -----------------------------------------------------------------------------
create function public.cancel_session(p_session_id uuid, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_title text;
  v_booking public.bookings%rowtype;
  v_count integer := 0;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;
  if not (private.is_privileged() or private.is_studio_admin(v_session.studio_id)) then
    perform private.fail('No tenés permiso para cancelar clases.', 'forbidden');
  end if;
  if v_session.status = 'cancelled' then
    return 0;
  end if;

  update public.sessions set
    status = 'cancelled',
    notes = coalesce(nullif(btrim(p_reason), ''), notes)
  where id = v_session.id;

  select title into v_title from public.offerings where id = v_session.offering_id;

  for v_booking in
    update public.bookings set
      status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      credit_refunded = true
    where session_id = v_session.id and status = 'booked'
    returning *
  loop
    perform private.refund_credit(v_booking, 'Clase cancelada por el estudio');
    perform private.enqueue_notification(
      v_session.studio_id, v_booking.student_id, 'session_cancelled',
      jsonb_build_object('session_id', v_session.id, 'title', v_title,
                         'starts_at', v_session.starts_at, 'reason', p_reason),
      now(), 'session_cancelled:' || v_booking.id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Cron: reservas que nadie marcó presentes pasan a ausente.
create function private.mark_no_shows()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.bookings b set status = 'no_show'
  from public.sessions s
  where s.id = b.session_id
    and b.status = 'booked'
    and s.ends_at < now() - interval '6 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.mark_no_shows() from public, anon, authenticated;

grant execute on function public.book_session(uuid, public.dance_role, uuid) to authenticated, service_role;
grant execute on function public.cancel_booking(uuid, boolean) to authenticated, service_role;
grant execute on function public.check_in(uuid, uuid) to authenticated, service_role;
grant execute on function public.check_in_by_qr(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_session(uuid, text) to authenticated, service_role;
