-- =============================================================================
-- Cupones de descuento (feature 'coupons', planes Estudio y Pro).
-- El estudio crea códigos (% o monto fijo) para packs, entradas o ambos, con
-- límite de usos, una vez por persona y vencimiento. Se usan en las compras
-- online: create_pack_payment y create_event_order reciben el código.
--
-- Cada uso queda en coupon_redemptions: 'pending' mientras se paga,
-- 'confirmed' al acreditarse y 'void' si el pago se cae (lo mantienen
-- triggers sobre payments y event_orders).
-- =============================================================================

create type public.coupon_kind as enum ('percent', 'amount');
create type public.coupon_target as enum ('all', 'packs', 'events');
create type public.coupon_redemption_status as enum ('pending', 'confirmed', 'void');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,29}$'),
  kind public.coupon_kind not null,
  -- percent: 1..100 · amount: centavos
  value bigint not null check (value > 0),
  applies_to public.coupon_target not null default 'all',
  max_uses integer check (max_uses > 0),
  once_per_person boolean not null default true,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  unique (studio_id, code),
  check (kind <> 'percent' or value <= 100)
);

create trigger coupons_updated_at before update on public.coupons
  for each row execute function private.set_updated_at();

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  coupon_id uuid not null,
  payment_id uuid,
  event_order_id uuid,
  student_id uuid,
  email text,
  discount_cents bigint not null check (discount_cents >= 0),
  status public.coupon_redemption_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((payment_id is null) <> (event_order_id is null)),
  foreign key (studio_id, coupon_id) references public.coupons (studio_id, id) on delete cascade,
  foreign key (studio_id, payment_id) references public.payments (studio_id, id) on delete cascade,
  foreign key (studio_id, event_order_id) references public.event_orders (studio_id, id) on delete cascade,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete set null (student_id)
);

create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id) where status <> 'void';
create unique index coupon_redemptions_payment_idx on public.coupon_redemptions (payment_id) where payment_id is not null;
create unique index coupon_redemptions_order_idx on public.coupon_redemptions (event_order_id) where event_order_id is not null;

create trigger coupon_redemptions_updated_at before update on public.coupon_redemptions
  for each row execute function private.set_updated_at();

alter table public.payments add column coupon_id uuid, add column discount_cents bigint not null default 0 check (discount_cents >= 0);
alter table public.payments add constraint payments_coupon_fk
  foreign key (studio_id, coupon_id) references public.coupons (studio_id, id) on delete set null (coupon_id);
alter table public.event_orders add column coupon_id uuid, add column discount_cents bigint not null default 0 check (discount_cents >= 0);
alter table public.event_orders add constraint event_orders_coupon_fk
  foreign key (studio_id, coupon_id) references public.coupons (studio_id, id) on delete set null (coupon_id);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupons, public.coupon_redemptions from anon, authenticated;

-- Los cupones los administra el admin (con la feature); nadie más los lista
-- (los códigos no son públicos: se validan por RPC).
grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;

create policy coupons_admin_read on public.coupons for select to authenticated
  using (private.is_studio_admin(studio_id));
create policy coupons_admin_insert on public.coupons for insert to authenticated
  with check (private.is_studio_admin(studio_id) and public.studio_has_feature(studio_id, 'coupons'));
create policy coupons_admin_update on public.coupons for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy coupons_admin_delete on public.coupons for delete to authenticated
  using (private.is_studio_admin(studio_id));
create policy coupon_redemptions_admin_read on public.coupon_redemptions for select to authenticated
  using (private.is_studio_admin(studio_id));

-- -----------------------------------------------------------------------------
-- Validación: devuelve el cupón y el descuento, o falla con un mensaje claro.
-- -----------------------------------------------------------------------------
create function private.coupon_discount(
  p_studio_id uuid,
  p_code text,
  p_target public.coupon_target,
  p_base_cents bigint,
  p_student_id uuid,
  p_email text
)
returns table (coupon_id uuid, discount_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_coupon public.coupons%rowtype;
  v_used integer;
  v_discount bigint;
begin
  select * into v_coupon from public.coupons c where c.studio_id = p_studio_id and c.code = v_code;
  if not found or not v_coupon.is_active then
    perform private.fail('Ese código no existe o ya no está activo.', 'coupon_not_found');
  end if;
  if not public.studio_has_feature(p_studio_id, 'coupons') then
    perform private.fail('Ese código no existe o ya no está activo.', 'coupon_not_found');
  end if;
  if v_coupon.valid_until is not null and v_coupon.valid_until <= now() then
    perform private.fail('Este código ya venció.', 'coupon_expired');
  end if;
  if v_coupon.applies_to <> 'all' and v_coupon.applies_to <> p_target then
    perform private.fail(
      case when v_coupon.applies_to = 'packs' then 'Este código vale solo para packs.' else 'Este código vale solo para entradas.' end,
      'coupon_wrong_target'
    );
  end if;

  -- Usos que cuentan: confirmados y los que se están pagando ahora.
  if v_coupon.max_uses is not null then
    select count(*)::integer into v_used from public.coupon_redemptions r
    where r.coupon_id = v_coupon.id
      and (r.status = 'confirmed' or (r.status = 'pending' and r.created_at > now() - interval '30 minutes'));
    if v_used >= v_coupon.max_uses then
      perform private.fail('Este código ya se usó todas las veces posibles.', 'coupon_exhausted');
    end if;
  end if;

  if v_coupon.once_per_person and exists (
    select 1 from public.coupon_redemptions r
    where r.coupon_id = v_coupon.id
      and (r.status = 'confirmed' or (r.status = 'pending' and r.created_at > now() - interval '30 minutes'))
      and ((p_student_id is not null and r.student_id = p_student_id)
           or (p_email is not null and r.email = lower(p_email)))
  ) then
    perform private.fail('Ya usaste este código.', 'coupon_already_used');
  end if;

  v_discount := case
    when v_coupon.kind = 'percent' then round(p_base_cents * v_coupon.value / 100.0)::bigint
    else least(v_coupon.value, p_base_cents)
  end;

  coupon_id := v_coupon.id;
  discount_cents := v_discount;
  return next;
end;
$$;

revoke execute on function private.coupon_discount(uuid, text, public.coupon_target, bigint, uuid, text)
  from public, anon, authenticated;

-- Para la pantalla de compra: precio final con el código (o el error).
create function public.preview_coupon(p_studio_id uuid, p_code text, p_target public.coupon_target, p_base_cents bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_email text;
  v_row record;
begin
  if p_target not in ('packs', 'events') or p_base_cents is null or p_base_cents <= 0 then
    perform private.fail('Ese código no existe o ya no está activo.', 'coupon_not_found');
  end if;
  if auth.uid() is not null then
    select id, email into v_student_id, v_email from public.students
    where studio_id = p_studio_id and user_id = auth.uid();
  end if;
  select * into v_row from private.coupon_discount(p_studio_id, p_code, p_target, p_base_cents, v_student_id, v_email);
  return jsonb_build_object(
    'discount_cents', v_row.discount_cents,
    'final_cents', p_base_cents - v_row.discount_cents
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Estado del uso según el pago / la orden.
-- -----------------------------------------------------------------------------
create function private.sync_coupon_redemption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.coupon_redemption_status;
begin
  if tg_table_name = 'payments' then
    v_status := case new.status when 'approved' then 'confirmed' when 'pending' then 'pending' else 'void' end;
    update public.coupon_redemptions set status = v_status where payment_id = new.id and status <> v_status;
  else
    v_status := case new.status when 'paid' then 'confirmed' when 'pending' then 'pending' else 'void' end;
    update public.coupon_redemptions set status = v_status where event_order_id = new.id and status <> v_status;
  end if;
  return null;
end;
$$;

revoke execute on function private.sync_coupon_redemption() from public, anon, authenticated;

create trigger payments_sync_coupon after update of status on public.payments
  for each row when (new.coupon_id is not null) execute function private.sync_coupon_redemption();
create trigger event_orders_sync_coupon after update of status on public.event_orders
  for each row when (new.coupon_id is not null) execute function private.sync_coupon_redemption();

-- -----------------------------------------------------------------------------
-- create_pack_payment con cupón.
-- -----------------------------------------------------------------------------
drop function public.create_pack_payment(uuid);

create function public.create_pack_payment(p_pack_product_id uuid, p_coupon text default null)
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
  v_coupon_id uuid;
  v_discount bigint := 0;
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

  if nullif(btrim(coalesce(p_coupon, '')), '') is not null then
    select c.coupon_id, c.discount_cents into v_coupon_id, v_discount
    from private.coupon_discount(v_product.studio_id, p_coupon, 'packs', v_product.price_cents, v_student.id, v_student.email) c;
    if v_product.price_cents - v_discount <= 0 then
      perform private.fail('Este código cubre todo el precio: pedile al estudio que te cargue el pack.', 'coupon_covers_all');
    end if;
  end if;

  insert into public.payments (
    studio_id, student_id, purpose, pack_product_id, amount_cents, method, status, created_by, coupon_id, discount_cents
  ) values (
    v_product.studio_id, v_student.id, 'pack', v_product.id, v_product.price_cents - v_discount, 'mercadopago', 'pending',
    v_uid, v_coupon_id, v_discount
  )
  returning * into v_payment;

  if v_coupon_id is not null then
    insert into public.coupon_redemptions (studio_id, coupon_id, payment_id, student_id, email, discount_cents)
    values (v_product.studio_id, v_coupon_id, v_payment.id, v_student.id, v_student.email, v_discount);
  end if;

  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_event_order con cupón (si el descuento cubre todo, queda confirmada).
-- -----------------------------------------------------------------------------
drop function public.create_event_order(uuid, integer, text, text, text);

create function public.create_event_order(
  p_ticket_type_id uuid,
  p_quantity integer,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text default null,
  p_coupon text default null
)
returns public.event_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.event_ticket_types%rowtype;
  v_event public.events%rowtype;
  v_order public.event_orders%rowtype;
  v_student_id uuid;
  v_name text := btrim(coalesce(p_buyer_name, ''));
  v_email text := lower(btrim(coalesce(p_buyer_email, '')));
  v_phone text := nullif(btrim(coalesce(p_buyer_phone, '')), '');
  v_base bigint;
  v_amount bigint;
  v_coupon_id uuid;
  v_discount bigint := 0;
begin
  -- Se bloquea el tipo de entrada: serializa las compras del mismo tipo.
  select * into v_type from public.event_ticket_types where id = p_ticket_type_id for update;
  if not found then
    perform private.fail('Esta entrada ya no está disponible.', 'ticket_type_not_found');
  end if;
  select * into v_event from public.events where id = v_type.event_id;

  if v_event.status <> 'published' or not v_type.is_active then
    perform private.fail('Este evento no tiene entradas a la venta.', 'not_on_sale');
  end if;
  if v_event.starts_at <= now() or (v_type.sales_end_at is not null and v_type.sales_end_at <= now()) then
    perform private.fail('Terminó la venta de esta entrada.', 'sales_ended');
  end if;
  if not public.studio_has_feature(v_event.studio_id, 'event_tickets') then
    perform private.fail('Este estudio no vende entradas online.', 'feature_not_in_plan');
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > v_type.max_per_order then
    perform private.fail(format('Podés comprar entre 1 y %s entradas por compra.', v_type.max_per_order), 'invalid_quantity');
  end if;
  if char_length(v_name) < 2 then
    perform private.fail('Poné tu nombre y apellido.', 'invalid_name');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.fail('Revisá el email: ahí te mandamos las entradas.', 'invalid_email');
  end if;

  if v_type.quantity is not null
     and private.ticket_type_taken(v_type.id) + p_quantity > v_type.quantity then
    if private.ticket_type_taken(v_type.id) >= v_type.quantity then
      perform private.fail('Se agotaron estas entradas.', 'sold_out');
    end if;
    perform private.fail(
      format('Quedan solo %s entradas de este tipo.', v_type.quantity - private.ticket_type_taken(v_type.id)),
      'not_enough_tickets'
    );
  end if;

  if auth.uid() is not null then
    select id into v_student_id from public.students
    where studio_id = v_event.studio_id and user_id = auth.uid();
  end if;

  v_base := v_type.price_cents * p_quantity;
  if v_base > 0 and nullif(btrim(coalesce(p_coupon, '')), '') is not null then
    select c.coupon_id, c.discount_cents into v_coupon_id, v_discount
    from private.coupon_discount(v_event.studio_id, p_coupon, 'events', v_base, v_student_id, v_email) c;
  end if;
  v_amount := v_base - v_discount;

  if v_amount > 0 and (
    not public.studio_has_feature(v_event.studio_id, 'mp_checkout')
    or not exists (select 1 from public.mp_connections where studio_id = v_event.studio_id)
  ) then
    perform private.fail('Este estudio todavía no cobra online. Consultá en el estudio cómo comprar.', 'mp_not_connected');
  end if;

  insert into public.event_orders (
    studio_id, event_id, ticket_type_id, quantity, buyer_name, buyer_email, buyer_phone, student_id,
    unit_price_cents, amount_cents, method, status, hold_expires_at, paid_at, created_by, coupon_id, discount_cents
  ) values (
    v_event.studio_id, v_event.id, v_type.id, p_quantity, v_name, v_email, v_phone, v_student_id,
    v_type.price_cents, v_amount,
    case when v_amount > 0 then 'mercadopago'::public.payment_method end,
    case when v_amount > 0 then 'pending' else 'paid' end::public.event_order_status,
    case when v_amount > 0 then now() + interval '20 minutes' end,
    case when v_amount = 0 then now() end,
    auth.uid(), v_coupon_id, v_discount
  )
  returning * into v_order;

  if v_coupon_id is not null then
    insert into public.coupon_redemptions (studio_id, coupon_id, event_order_id, student_id, email, discount_cents, status)
    values (
      v_event.studio_id, v_coupon_id, v_order.id, v_student_id, v_email, v_discount,
      case when v_order.status = 'paid' then 'confirmed' else 'pending' end::public.coupon_redemption_status
    );
  end if;

  if v_order.status = 'paid' then
    perform private.issue_event_tickets(v_order.id);
  end if;

  return v_order;
end;
$$;

grant execute on function public.create_pack_payment(uuid, text) to authenticated;
grant execute on function public.create_event_order(uuid, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.preview_coupon(uuid, text, public.coupon_target, bigint) to anon, authenticated;
