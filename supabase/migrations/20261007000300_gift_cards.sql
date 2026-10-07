-- =============================================================================
-- Gift cards: regalar un pack (feature 'gift_cards', planes Estudio y Pro).
-- Cualquiera compra un pack de regalo (online con MP o en el mostrador) y
-- recibe una tarjeta con un código. Quien la recibe se suma al estudio y la
-- canjea: se le acredita el pack (la validez corre desde el canje). Si nadie
-- la canjea, vence a los 12 meses de pagada.
-- =============================================================================

create type public.gift_card_status as enum ('pending', 'active', 'redeemed', 'cancelled', 'expired');

/** Código legible, sin letras que se confunden: REGALO-7K2M-Q9XA */
create function private.gift_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_out text := '';
  i integer;
begin
  for i in 0..7 loop
    v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    if i = 3 then v_out := v_out || '-'; end if;
  end loop;
  return 'REGALO-' || v_out;
end;
$$;

revoke execute on function private.gift_code() from public, anon, authenticated;

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  code text not null unique default private.gift_code(),
  pack_product_id uuid,
  -- Copia del pack al momento de la compra (si después lo editan, el regalo no cambia).
  pack_name text not null,
  credits integer check (credits between 1 and 1000),
  validity_days smallint not null check (validity_days between 1 and 730),
  amount_cents bigint not null check (amount_cents >= 0),
  buyer_name text not null check (char_length(btrim(buyer_name)) between 2 and 120),
  buyer_email text check (buyer_email = lower(buyer_email) and char_length(buyer_email) <= 254),
  recipient_name text check (char_length(recipient_name) <= 120),
  message text check (char_length(message) <= 500),
  method public.payment_method,
  status public.gift_card_status not null default 'pending',
  access_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  external_reference uuid not null unique default gen_random_uuid(),
  mp_preference_id text,
  mp_payment_id text unique,
  paid_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_student_id uuid,
  student_pack_id uuid,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  check (status not in ('active', 'redeemed') or (paid_at is not null and expires_at is not null)),
  foreign key (studio_id, pack_product_id) references public.pack_products (studio_id, id) on delete set null (pack_product_id),
  foreign key (studio_id, redeemed_student_id) references public.students (studio_id, id) on delete set null (redeemed_student_id),
  foreign key (studio_id, student_pack_id) references public.student_packs (studio_id, id) on delete set null (student_pack_id)
);

create index gift_cards_studio_idx on public.gift_cards (studio_id, created_at desc);
create index gift_cards_paid_idx on public.gift_cards (studio_id, paid_at) where paid_at is not null;

create trigger gift_cards_updated_at before update on public.gift_cards
  for each row execute function private.set_updated_at();

alter table public.gift_cards enable row level security;
revoke all on public.gift_cards from anon, authenticated;
-- El staff los ve (sin el link privado); se escriben por RPC.
grant select (id, studio_id, code, pack_name, credits, validity_days, amount_cents, buyer_name, buyer_email,
  recipient_name, message, method, status, paid_at, expires_at, redeemed_at, redeemed_student_id, notes, created_at)
  on public.gift_cards to authenticated;
create policy gift_cards_staff_read on public.gift_cards for select to authenticated
  using (private.is_studio_staff(studio_id));

-- Vencida = activa con la fecha pasada (se calcula al leer; el cron la marca).
create function private.gift_card_activate(p_id uuid, p_method public.payment_method, p_mp_payment_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.gift_cards%rowtype;
begin
  update public.gift_cards set
    status = 'active',
    method = p_method,
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
    paid_at = now(),
    expires_at = now() + interval '12 months'
  where id = p_id and status = 'pending'
  returning * into v_card;

  if found and v_card.buyer_email is not null then
    insert into public.notifications (studio_id, template, to_address, payload, dedupe_key)
    values (v_card.studio_id, 'gift_card', v_card.buyer_email,
            jsonb_build_object('gift_card_id', v_card.id), 'gift_card:' || v_card.id)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

revoke execute on function private.gift_card_activate(uuid, public.payment_method, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Compra online (sin cuenta). El precio sale del pack.
-- -----------------------------------------------------------------------------
create function public.create_gift_card_order(
  p_pack_product_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_recipient_name text default null,
  p_message text default null
)
returns public.gift_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.pack_products%rowtype;
  v_card public.gift_cards%rowtype;
  v_email text := lower(btrim(coalesce(p_buyer_email, '')));
begin
  select * into v_product from public.pack_products where id = p_pack_product_id and is_active;
  if not found or v_product.is_couple then
    perform private.fail('Este pack no se puede regalar.', 'pack_not_giftable');
  end if;
  if not public.studio_has_feature(v_product.studio_id, 'gift_cards') then
    perform private.fail('Este estudio no vende regalos online.', 'feature_not_in_plan');
  end if;
  if v_product.price_cents <= 0 then
    perform private.fail('Este pack no se puede regalar.', 'pack_not_giftable');
  end if;
  if not public.studio_has_feature(v_product.studio_id, 'mp_checkout')
     or not exists (select 1 from public.mp_connections where studio_id = v_product.studio_id) then
    perform private.fail('Este estudio todavía no cobra online. Consultá en el estudio.', 'mp_not_connected');
  end if;
  if char_length(btrim(coalesce(p_buyer_name, ''))) < 2 then
    perform private.fail('Poné tu nombre.', 'invalid_name');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.fail('Revisá tu email: ahí te mandamos la tarjeta.', 'invalid_email');
  end if;

  insert into public.gift_cards (
    studio_id, pack_product_id, pack_name, credits, validity_days, amount_cents,
    buyer_name, buyer_email, recipient_name, message, method, created_by
  ) values (
    v_product.studio_id, v_product.id, v_product.name, v_product.credits, v_product.validity_days, v_product.price_cents,
    btrim(p_buyer_name), v_email, nullif(btrim(coalesce(p_recipient_name, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''), 'mercadopago', auth.uid()
  )
  returning * into v_card;
  return v_card;
end;
$$;

-- Venta en el mostrador (efectivo o transferencia).
create function public.sell_gift_card_manual(
  p_pack_product_id uuid,
  p_buyer_name text,
  p_method public.payment_method,
  p_recipient_name text default null,
  p_message text default null,
  p_buyer_email text default null
)
returns public.gift_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.pack_products%rowtype;
  v_card public.gift_cards%rowtype;
  v_email text := nullif(lower(btrim(coalesce(p_buyer_email, ''))), '');
begin
  select * into v_product from public.pack_products where id = p_pack_product_id;
  if not found or v_product.is_couple then
    perform private.fail('Este pack no se puede regalar.', 'pack_not_giftable');
  end if;
  if not private.can_take_payments(v_product.studio_id) then
    perform private.fail('No tenés permiso para registrar pagos. Pedíselo al dueño del estudio.', 'cannot_take_payments');
  end if;
  if not public.studio_has_feature(v_product.studio_id, 'gift_cards') then
    perform private.fail('Las gift cards no están incluidas en tu plan.', 'feature_not_in_plan');
  end if;
  if p_method is null or p_method = 'mercadopago' then
    perform private.fail('Elegí efectivo o transferencia.', 'invalid_method');
  end if;
  if char_length(btrim(coalesce(p_buyer_name, ''))) < 2 then
    perform private.fail('Poné el nombre de quien la compra.', 'invalid_name');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.fail('Revisá el email.', 'invalid_email');
  end if;

  insert into public.gift_cards (
    studio_id, pack_product_id, pack_name, credits, validity_days, amount_cents,
    buyer_name, buyer_email, recipient_name, message, method, created_by
  ) values (
    v_product.studio_id, v_product.id, v_product.name, v_product.credits, v_product.validity_days, v_product.price_cents,
    btrim(p_buyer_name), v_email, nullif(btrim(coalesce(p_recipient_name, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''), p_method, auth.uid()
  )
  returning * into v_card;

  perform private.gift_card_activate(v_card.id, p_method);
  select * into v_card from public.gift_cards where id = v_card.id;
  return v_card;
end;
$$;

-- Webhook de MP. Solo service role. Idempotente.
create function public.mp_apply_gift_payment(
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
  v_card public.gift_cards%rowtype;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;
  select * into v_card from public.gift_cards where external_reference = p_external_reference for update;
  if not found then
    perform private.fail('No encontramos ese regalo.', 'gift_not_found');
  end if;

  if p_mp_status = 'approved' then
    if v_card.status <> 'pending' then
      return jsonb_build_object('gift_card_id', v_card.id, 'status', v_card.status, 'ignored', 'not_pending');
    end if;
    if p_amount_cents is distinct from v_card.amount_cents then
      update public.gift_cards set notes = concat_ws(E'\n', notes,
        format('MP %s aprobado por %s centavos (esperado %s): revisar.', p_mp_payment_id, p_amount_cents, v_card.amount_cents))
      where id = v_card.id;
      return jsonb_build_object('gift_card_id', v_card.id, 'status', v_card.status, 'ignored', 'amount_mismatch');
    end if;
    perform private.gift_card_activate(v_card.id, 'mercadopago', p_mp_payment_id);
    return jsonb_build_object('gift_card_id', v_card.id, 'status', 'active');
  end if;

  if p_mp_status in ('refunded', 'charged_back') and v_card.status = 'active' then
    update public.gift_cards set status = 'cancelled', notes = concat_ws(E'\n', notes, 'Pago reintegrado.') where id = v_card.id;
    return jsonb_build_object('gift_card_id', v_card.id, 'status', 'cancelled');
  end if;

  if p_mp_status in ('rejected', 'cancelled') and v_card.status = 'pending' then
    update public.gift_cards set status = 'cancelled' where id = v_card.id;
  end if;
  return jsonb_build_object('gift_card_id', v_card.id, 'status', v_card.status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Canje: el alumno (con su código) o el staff por un alumno.
-- -----------------------------------------------------------------------------
create function public.redeem_gift_card(p_code text, p_student_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_card public.gift_cards%rowtype;
  v_student public.students%rowtype;
  v_timezone text;
  v_pack public.student_packs%rowtype;
begin
  if v_code !~ '^REGALO-' then
    v_code := 'REGALO-' || v_code;
  end if;
  select * into v_card from public.gift_cards where code = v_code for update;

  -- Quién recibe el pack.
  if p_student_id is not null then
    select * into v_student from public.students where id = p_student_id;
    if not found or v_card.id is null or v_student.studio_id <> v_card.studio_id
       or not (private.is_privileged() or private.is_studio_staff(v_student.studio_id)) then
      perform private.fail('Ese código no existe en este estudio.', 'gift_not_found');
    end if;
  else
    if auth.uid() is null then
      perform private.fail('Tenés que iniciar sesión para canjear tu regalo.', 'not_authenticated');
    end if;
    if v_card.id is null then
      perform private.fail('Ese código no existe. Revisá que esté bien escrito.', 'gift_not_found');
    end if;
    select * into v_student from public.students where studio_id = v_card.studio_id and user_id = auth.uid();
    if not found then
      perform private.fail('Este regalo es de otro estudio.', 'gift_not_found');
    end if;
  end if;

  if v_card.status = 'redeemed' then
    perform private.fail('Este regalo ya se canjeó.', 'gift_redeemed');
  end if;
  if v_card.status <> 'active' then
    perform private.fail('Este regalo todavía no está pago o fue cancelado.', 'gift_not_active');
  end if;
  if v_card.expires_at <= now() then
    perform private.fail('Este regalo venció. Hablá con el estudio.', 'gift_expired');
  end if;

  select timezone into v_timezone from public.studios where id = v_card.studio_id;
  insert into public.student_packs (studio_id, student_id, pack_product_id, name, credits_total, starts_at, expires_at)
  values (v_card.studio_id, v_student.id, v_card.pack_product_id, v_card.pack_name, v_card.credits, now(),
          private.pack_expires_at(v_timezone, now(), v_card.validity_days))
  returning * into v_pack;

  insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note, created_by)
  values (v_pack.studio_id, v_pack.id, 'grant', coalesce(v_card.credits, 0), 'Canje de gift card ' || v_card.code, auth.uid());

  update public.gift_cards set status = 'redeemed', redeemed_at = now(), redeemed_student_id = v_student.id,
    student_pack_id = v_pack.id
  where id = v_card.id;

  perform private.enqueue_notification(
    v_pack.studio_id, v_pack.student_id, 'pack_granted',
    jsonb_build_object('student_pack_id', v_pack.id, 'name', v_pack.name, 'credits', v_pack.credits_total, 'expires_at', v_pack.expires_at),
    now(), 'pack_granted:' || v_pack.id
  );

  return jsonb_build_object('student_pack_id', v_pack.id, 'pack_name', v_pack.name, 'credits', v_pack.credits_total, 'expires_at', v_pack.expires_at);
end;
$$;

create function public.cancel_gift_card(p_gift_card_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.gift_cards%rowtype;
begin
  select * into v_card from public.gift_cards where id = p_gift_card_id for update;
  if not found or not (private.is_privileged() or private.is_studio_admin(v_card.studio_id)) then
    perform private.fail('No encontramos ese regalo.', 'gift_not_found');
  end if;
  if v_card.status not in ('pending', 'active') then
    perform private.fail('Este regalo ya no se puede cancelar.', 'gift_not_active');
  end if;
  update public.gift_cards set status = 'cancelled',
    notes = concat_ws(E'\n', notes, nullif(btrim(coalesce(p_reason, '')), ''))
  where id = v_card.id;
end;
$$;

/** "Tu regalo": la tarjeta, por el link privado (sin cuenta). */
create function public.get_gift_card(p_access_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', g.code, 'status', g.status, 'pack_name', g.pack_name, 'credits', g.credits,
    'validity_days', g.validity_days, 'recipient_name', g.recipient_name, 'buyer_name', g.buyer_name,
    'message', g.message, 'expires_at', g.expires_at, 'amount_cents', g.amount_cents,
    'studio', jsonb_build_object('name', s.name, 'slug', s.slug)
  )
  from public.gift_cards g join public.studios s on s.id = g.studio_id
  where g.access_token = p_access_token
$$;

-- Vencimiento (cron diario) y limpieza de compras online abandonadas.
create function public.expire_gift_cards()
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
  update public.gift_cards set status = 'expired' where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;
  update public.gift_cards set status = 'cancelled', notes = 'Compra online sin pagar.'
  where status = 'pending' and method = 'mercadopago' and created_at < now() - interval '2 days';
  return v_count;
end;
$$;

grant execute on function public.create_gift_card_order(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.sell_gift_card_manual(uuid, text, public.payment_method, text, text, text) to authenticated, service_role;
grant execute on function public.mp_apply_gift_payment(uuid, text, text, bigint) to service_role;
grant execute on function public.redeem_gift_card(text, uuid) to authenticated, service_role;
grant execute on function public.cancel_gift_card(uuid, text) to authenticated, service_role;
grant execute on function public.get_gift_card(text) to anon, authenticated, service_role;
grant execute on function public.expire_gift_cards() to service_role;

select cron.schedule('giroa_expire_gift_cards', '15 3 * * *', $$select public.expire_gift_cards()$$);
