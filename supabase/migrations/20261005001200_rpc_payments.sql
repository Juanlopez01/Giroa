-- =============================================================================
-- Pagos y packs: acreditar (idempotente), pagos manuales, checkout de MP,
-- aplicación del webhook y vencimientos.
-- =============================================================================

-- Primer instante en que el pack ya no vale: medianoche local del día
-- siguiente a (fecha de inicio + validez). Comprado el 1/10 con 30 días,
-- vale hasta el 31/10 inclusive.
create function private.pack_expires_at(p_timezone text, p_from timestamptz, p_validity_days integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (((p_from at time zone p_timezone)::date + p_validity_days + 1)::timestamp) at time zone p_timezone
$$;

-- Acredita el pack de un pago aprobado. Idempotente: si ya existe, lo devuelve.
-- Sin chequeo de permisos: lo llaman funciones que ya validaron.
create function private.grant_pack_core(p_payment_id uuid)
returns public.student_packs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_product public.pack_products%rowtype;
  v_timezone text;
  v_pack public.student_packs%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    perform private.fail('No encontramos ese pago.', 'payment_not_found');
  end if;

  select * into v_pack from public.student_packs where payment_id = v_payment.id;
  if found then
    return v_pack;
  end if;

  if v_payment.status <> 'approved' then
    perform private.fail('El pago todavía no está aprobado.', 'payment_not_approved');
  end if;
  if v_payment.purpose <> 'pack' then
    perform private.fail('Este pago no corresponde a un pack.', 'invalid_purpose');
  end if;

  select * into v_product from public.pack_products
  where id = v_payment.pack_product_id and studio_id = v_payment.studio_id;
  select timezone into v_timezone from public.studios where id = v_payment.studio_id;

  insert into public.student_packs (
    studio_id, student_id, partner_student_id, pack_product_id, payment_id,
    name, credits_total, starts_at, expires_at
  ) values (
    v_payment.studio_id, v_payment.student_id, v_payment.partner_student_id, v_product.id, v_payment.id,
    v_product.name, v_product.credits, v_payment.paid_at,
    private.pack_expires_at(v_timezone, v_payment.paid_at, v_product.validity_days)
  )
  returning * into v_pack;

  insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note, created_by)
  values (v_pack.studio_id, v_pack.id, 'grant', coalesce(v_product.credits, 0), 'Acreditación del pago', auth.uid());

  perform private.enqueue_notification(
    v_pack.studio_id, v_pack.student_id, 'pack_granted',
    jsonb_build_object('student_pack_id', v_pack.id, 'name', v_pack.name,
                       'credits', v_pack.credits_total, 'expires_at', v_pack.expires_at),
    now(), 'pack_granted:' || v_pack.id
  );

  return v_pack;
end;
$$;

revoke execute on function private.grant_pack_core(uuid) from public, anon, authenticated;

create function public.grant_pack(p_payment_id uuid)
returns public.student_packs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio_id uuid;
begin
  select studio_id into v_studio_id from public.payments where id = p_payment_id;
  if v_studio_id is null
     or not (private.is_privileged() or private.is_studio_admin(v_studio_id)) then
    perform private.fail('No encontramos ese pago.', 'payment_not_found');
  end if;
  return private.grant_pack_core(p_payment_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pago manual (efectivo o transferencia) cargado por el staff. Acredita el pack.
-- -----------------------------------------------------------------------------
create function public.record_manual_payment(
  p_student_id uuid,
  p_pack_product_id uuid,
  p_method public.payment_method,
  p_amount_cents bigint default null,
  p_notes text default null,
  p_partner_student_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_product public.pack_products%rowtype;
  v_payment public.payments%rowtype;
  v_pack public.student_packs%rowtype;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found or not (private.is_privileged() or private.is_studio_staff(v_student.studio_id)) then
    perform private.fail('No encontramos a ese alumno en el estudio.', 'student_not_found');
  end if;

  if p_method not in ('cash', 'transfer') then
    perform private.fail('Los pagos manuales son en efectivo o por transferencia.', 'invalid_method');
  end if;

  select * into v_product from public.pack_products
  where id = p_pack_product_id and studio_id = v_student.studio_id;
  if not found then
    perform private.fail('No encontramos ese pack.', 'pack_not_found');
  end if;

  if p_amount_cents is not null and p_amount_cents < 0 then
    perform private.fail('El monto no puede ser negativo.', 'invalid_amount');
  end if;

  if p_partner_student_id is not null then
    if not v_product.is_couple then
      perform private.fail('Este pack no es de pareja.', 'not_couple_pack');
    end if;
    if p_partner_student_id = p_student_id or not exists (
      select 1 from public.students
      where id = p_partner_student_id and studio_id = v_student.studio_id
    ) then
      perform private.fail('No encontramos a la pareja en el estudio.', 'partner_not_found');
    end if;
  end if;

  insert into public.payments (
    studio_id, student_id, partner_student_id, purpose, pack_product_id,
    amount_cents, method, status, paid_at, notes, created_by
  ) values (
    v_student.studio_id, v_student.id, p_partner_student_id, 'pack', v_product.id,
    coalesce(p_amount_cents, v_product.price_cents), p_method, 'approved', now(),
    nullif(btrim(p_notes), ''), auth.uid()
  )
  returning * into v_payment;

  v_pack := private.grant_pack_core(v_payment.id);

  return jsonb_build_object('payment_id', v_payment.id, 'student_pack_id', v_pack.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Checkout de MP: el alumno inicia la compra. Crea el pago pendiente con el
-- precio del producto (nunca el que mande el cliente). El servidor después
-- arma la preferencia con external_reference = payments.external_reference.
-- -----------------------------------------------------------------------------
create function public.create_pack_payment(p_pack_product_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.pack_products%rowtype;
  v_student public.students%rowtype;
  v_payment public.payments%rowtype;
begin
  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión para comprar.', 'not_authenticated');
  end if;

  select * into v_product from public.pack_products where id = p_pack_product_id and is_active;
  if not found then
    perform private.fail('Este pack ya no está disponible.', 'pack_not_found');
  end if;

  select * into v_student from public.students
  where studio_id = v_product.studio_id and user_id = v_uid;
  if not found then
    perform private.fail('Todavía no sos alumno/a de este estudio. Sumate para comprar.', 'not_a_student');
  end if;
  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio. Hablá con el estudio para reactivarla.', 'student_inactive');
  end if;

  if not public.studio_has_feature(v_product.studio_id, 'mp_checkout')
     or not exists (select 1 from public.mp_connections where studio_id = v_product.studio_id) then
    perform private.fail('Este estudio todavía no cobra online. Consultá en el estudio cómo pagar.', 'mp_not_connected');
  end if;

  insert into public.payments (studio_id, student_id, purpose, pack_product_id, amount_cents, method, status, created_by)
  values (v_product.studio_id, v_student.id, 'pack', v_product.id, v_product.price_cents, 'mercadopago', 'pending', v_uid)
  returning * into v_payment;

  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- Aplica el estado de un pago de MP ya consultado a la API por el servidor
-- (nunca el body del webhook). Solo service role. Idempotente.
-- p_mp_status: el status de MP (approved, pending, in_process, authorized,
-- rejected, cancelled, refunded, charged_back).
-- -----------------------------------------------------------------------------
create function public.mp_apply_payment(
  p_external_reference uuid,
  p_mp_payment_id text,
  p_mp_status text,
  p_amount_cents bigint,
  p_paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_status public.payment_status;
  v_pack public.student_packs%rowtype;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  select * into v_payment from public.payments where external_reference = p_external_reference for update;
  if not found then
    perform private.fail('No encontramos ese pago.', 'payment_not_found');
  end if;

  v_status := case p_mp_status
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'cancelled' then 'cancelled'
    when 'refunded' then 'refunded'
    when 'charged_back' then 'refunded'
    else 'pending'
  end::public.payment_status;

  -- Ya aprobado con otro pago de MP (reintento del checkout): no se toca.
  if v_payment.status = 'approved' and v_payment.mp_payment_id is distinct from p_mp_payment_id then
    return jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status, 'ignored', 'already_approved');
  end if;

  if v_status = 'approved' then
    if p_amount_cents is distinct from v_payment.amount_cents then
      update public.payments set notes = concat_ws(E'\n', notes,
        format('MP %s aprobado por %s centavos (esperado %s): revisar.', p_mp_payment_id, p_amount_cents, v_payment.amount_cents))
      where id = v_payment.id;
      return jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status, 'ignored', 'amount_mismatch');
    end if;

    if v_payment.status <> 'approved' then
      update public.payments set
        status = 'approved',
        mp_payment_id = p_mp_payment_id,
        paid_at = coalesce(p_paid_at, now())
      where id = v_payment.id;
    end if;

    v_pack := private.grant_pack_core(v_payment.id);
    return jsonb_build_object('payment_id', v_payment.id, 'status', 'approved', 'student_pack_id', v_pack.id);
  end if;

  if v_status = 'refunded' then
    if v_payment.status = 'approved' then
      update public.payments set status = 'refunded' where id = v_payment.id;
      update public.student_packs set status = 'cancelled' where payment_id = v_payment.id;
    end if;
    return jsonb_build_object('payment_id', v_payment.id, 'status', 'refunded');
  end if;

  -- pending / rejected / cancelled: nunca pisa un aprobado (webhooks desordenados).
  if v_payment.status in ('pending', 'rejected', 'cancelled') then
    update public.payments set status = v_status, mp_payment_id = p_mp_payment_id
    where id = v_payment.id;
  end if;

  return jsonb_build_object('payment_id', v_payment.id, 'status', v_status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Vencimiento de packs (cron diario).
-- -----------------------------------------------------------------------------
create function public.expire_packs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  with expired as (
    update public.student_packs
    set status = 'expired'
    where status = 'active' and expires_at <= now()
    returning id, studio_id, credits_total, credits_used
  )
  insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note)
  select studio_id, id, 'expire', -coalesce(credits_total - credits_used, 0), 'Vencimiento automático'
  from expired;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Aviso 3 días antes del vencimiento (cron diario). Una vez por pack.
create function private.enqueue_pack_expiring()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack record;
  v_count integer := 0;
begin
  for v_pack in
    select b.*
    from public.student_balances b
    join public.student_packs sp on sp.id = b.student_pack_id
    where b.is_usable
      and b.expires_at <= now() + interval '3 days'
      and sp.created_at < now() - interval '1 day'
  loop
    perform private.enqueue_notification(
      v_pack.studio_id, v_pack.student_id, 'pack_expiring',
      jsonb_build_object('student_pack_id', v_pack.student_pack_id, 'name', v_pack.name,
                         'credits_remaining', v_pack.credits_remaining, 'expires_on', v_pack.expires_on),
      now(), 'pack_expiring:' || v_pack.student_pack_id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Recordatorio de clase reservada, unas 2-3 horas antes (cron cada hora).
create function private.enqueue_class_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select b.id as booking_id, b.studio_id, b.student_id, s.id as session_id, s.starts_at, o.title
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    join public.offerings o on o.id = s.offering_id
    where b.status = 'booked'
      and s.status = 'scheduled'
      and s.starts_at > now() + interval '1 hour'
      and s.starts_at <= now() + interval '3 hours'
  loop
    perform private.enqueue_notification(
      v_row.studio_id, v_row.student_id, 'class_reminder',
      jsonb_build_object('booking_id', v_row.booking_id, 'session_id', v_row.session_id,
                         'title', v_row.title, 'starts_at', v_row.starts_at),
      now(), 'class_reminder:' || v_row.booking_id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.enqueue_pack_expiring() from public, anon, authenticated;
revoke execute on function private.enqueue_class_reminders() from public, anon, authenticated;

grant execute on function public.grant_pack(uuid) to authenticated, service_role;
grant execute on function public.record_manual_payment(uuid, uuid, public.payment_method, bigint, text, uuid) to authenticated, service_role;
grant execute on function public.create_pack_payment(uuid) to authenticated;
grant execute on function public.mp_apply_payment(uuid, text, text, bigint, timestamptz) to service_role;
grant execute on function public.expire_packs() to service_role;
