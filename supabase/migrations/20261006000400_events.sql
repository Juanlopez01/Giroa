-- =============================================================================
-- Eventos con entradas (feature 'event_tickets', planes Estudio y Pro).
-- Milongas, seminarios, muestras: fuera de la grilla, se pagan aparte y los
-- compra cualquiera (no hace falta ser alumno ni tener cuenta).
--
--   events              el evento (lo maneja el admin, con RLS)
--   event_ticket_types  tipos de entrada: precio, cupo, fin de venta
--   event_orders        una compra (comprador + pago). Solo por RPC.
--   event_tickets       una entrada por persona, con su QR. Solo por RPC.
--
-- El cupo se calcula con las órdenes pagas + las pendientes que todavía están
-- dentro de su reserva de 20 minutos. create_event_order bloquea la fila del
-- tipo de entrada, así dos compras simultáneas no sobrevenden.
-- =============================================================================

create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.event_order_status as enum ('pending', 'paid', 'expired', 'cancelled', 'refunded');
create type public.event_ticket_status as enum ('valid', 'cancelled');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 4000),
  venue text check (char_length(venue) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  check (ends_at is null or ends_at > starts_at)
);

create index events_studio_starts_idx on public.events (studio_id, starts_at);

create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();

create table public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  event_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  price_cents bigint not null check (price_cents >= 0),
  quantity integer check (quantity between 1 and 100000), -- null = sin límite
  sales_end_at timestamptz,
  max_per_order smallint not null default 10 check (max_per_order between 1 and 20),
  is_active boolean not null default true,
  sort smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  foreign key (studio_id, event_id) references public.events (studio_id, id) on delete cascade
);

create index event_ticket_types_event_idx on public.event_ticket_types (event_id);

create trigger event_ticket_types_updated_at before update on public.event_ticket_types
  for each row execute function private.set_updated_at();

create table public.event_orders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  event_id uuid not null,
  ticket_type_id uuid not null,
  quantity smallint not null check (quantity between 1 and 20),
  buyer_name text not null check (char_length(btrim(buyer_name)) between 2 and 120),
  buyer_email text check (buyer_email = lower(buyer_email) and char_length(buyer_email) <= 254),
  buyer_phone text check (char_length(buyer_phone) <= 40),
  student_id uuid,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  amount_cents bigint not null check (amount_cents >= 0),
  -- null = entrada gratis.
  method public.payment_method,
  status public.event_order_status not null default 'pending',
  -- Link privado de "tus entradas" (no requiere cuenta).
  access_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  external_reference uuid not null unique default gen_random_uuid(),
  mp_preference_id text,
  mp_payment_id text unique,
  marketplace_fee_cents bigint not null default 0 check (marketplace_fee_cents >= 0),
  hold_expires_at timestamptz,
  paid_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  check (status <> 'paid' or paid_at is not null),
  check (amount_cents = 0 or method is not null),
  foreign key (studio_id, event_id) references public.events (studio_id, id) on delete restrict,
  foreign key (studio_id, ticket_type_id) references public.event_ticket_types (studio_id, id) on delete restrict,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete set null (student_id)
);

create index event_orders_event_idx on public.event_orders (event_id, created_at desc);
create index event_orders_type_active_idx on public.event_orders (ticket_type_id) where status in ('pending', 'paid');
create index event_orders_studio_paid_idx on public.event_orders (studio_id, paid_at) where status = 'paid';

create trigger event_orders_updated_at before update on public.event_orders
  for each row execute function private.set_updated_at();

create table public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  order_id uuid not null,
  event_id uuid not null,
  ticket_type_id uuid not null,
  number smallint not null check (number >= 1),
  qr_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  status public.event_ticket_status not null default 'valid',
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (studio_id, id),
  unique (order_id, number),
  foreign key (studio_id, order_id) references public.event_orders (studio_id, id) on delete cascade,
  foreign key (studio_id, event_id) references public.events (studio_id, id) on delete restrict,
  foreign key (studio_id, ticket_type_id) references public.event_ticket_types (studio_id, id) on delete restrict
);

create index event_tickets_event_idx on public.event_tickets (event_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_ticket_types enable row level security;
alter table public.event_orders enable row level security;
alter table public.event_tickets enable row level security;

revoke all on public.events, public.event_ticket_types, public.event_orders, public.event_tickets
  from anon, authenticated;

grant select on public.events, public.event_ticket_types to anon, authenticated;
grant insert, update, delete on public.events, public.event_ticket_types to authenticated;
-- Órdenes y entradas: solo lectura para el staff; se escriben por RPC.
grant select on public.event_orders, public.event_tickets to authenticated;

-- Público: eventos publicados. Staff: todos los de su estudio.
create policy events_read on public.events for select to anon, authenticated
  using (status <> 'draft' or private.is_studio_staff(studio_id));
-- Crear eventos requiere la feature del plan.
create policy events_admin_insert on public.events for insert to authenticated
  with check (private.is_studio_admin(studio_id) and public.studio_has_feature(studio_id, 'event_tickets'));
create policy events_admin_update on public.events for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy events_admin_delete on public.events for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy event_ticket_types_read on public.event_ticket_types for select to anon, authenticated
  using (
    private.is_studio_staff(studio_id)
    or (is_active and exists (
      select 1 from public.events e where e.id = event_id and e.status <> 'draft'
    ))
  );
create policy event_ticket_types_admin_insert on public.event_ticket_types for insert to authenticated
  with check (private.is_studio_admin(studio_id) and public.studio_has_feature(studio_id, 'event_tickets'));
create policy event_ticket_types_admin_update on public.event_ticket_types for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy event_ticket_types_admin_delete on public.event_ticket_types for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy event_orders_staff_read on public.event_orders for select to authenticated
  using (private.is_studio_staff(studio_id));
create policy event_tickets_staff_read on public.event_tickets for select to authenticated
  using (private.is_studio_staff(studio_id));

-- -----------------------------------------------------------------------------
-- Cupo
-- -----------------------------------------------------------------------------

/** Entradas tomadas de un tipo: pagas + pendientes dentro de su reserva. */
create function private.ticket_type_taken(p_ticket_type_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.event_orders
  where ticket_type_id = p_ticket_type_id
    and (status = 'paid' or (status = 'pending' and hold_expires_at > now()));
$$;

revoke execute on function private.ticket_type_taken(uuid) from public, anon, authenticated;

/** Disponibilidad pública de los tipos de entrada de un evento publicado. */
create function public.event_availability(p_event_id uuid)
returns table (ticket_type_id uuid, remaining integer, on_sale boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    case when t.quantity is null then null
         else greatest(t.quantity - private.ticket_type_taken(t.id), 0) end,
    e.status = 'published' and e.starts_at > now() and t.is_active
      and (t.sales_end_at is null or t.sales_end_at > now())
  from public.event_ticket_types t
  join public.events e on e.id = t.event_id
  where t.event_id = p_event_id
    and (e.status <> 'draft' or private.is_studio_staff(e.studio_id));
$$;

-- -----------------------------------------------------------------------------
-- Emisión de entradas (al quedar paga la orden). Idempotente.
-- -----------------------------------------------------------------------------
create function private.issue_event_tickets(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.event_orders%rowtype;
begin
  select * into v_order from public.event_orders where id = p_order_id;
  if v_order.status <> 'paid' then
    return;
  end if;

  insert into public.event_tickets (studio_id, order_id, event_id, ticket_type_id, number)
  select v_order.studio_id, v_order.id, v_order.event_id, v_order.ticket_type_id, n
  from generate_series(1, v_order.quantity) as n
  on conflict (order_id, number) do nothing;

  -- Mail con las entradas (lo manda el worker del outbox).
  if v_order.buyer_email is not null then
    insert into public.notifications (studio_id, student_id, template, to_address, payload, dedupe_key)
    values (
      v_order.studio_id, v_order.student_id, 'event_tickets', v_order.buyer_email,
      jsonb_build_object('order_id', v_order.id, 'access_token', v_order.access_token),
      'event_tickets:' || v_order.id
    )
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

revoke execute on function private.issue_event_tickets(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Compra online (o gratis). La llama cualquiera, con o sin cuenta.
-- El precio sale del tipo de entrada, nunca del cliente.
-- -----------------------------------------------------------------------------
create function public.create_event_order(
  p_ticket_type_id uuid,
  p_quantity integer,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text default null
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
  v_amount bigint;
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

  v_amount := v_type.price_cents * p_quantity;

  if v_amount > 0 and (
    not public.studio_has_feature(v_event.studio_id, 'mp_checkout')
    or not exists (select 1 from public.mp_connections where studio_id = v_event.studio_id)
  ) then
    perform private.fail('Este estudio todavía no cobra online. Consultá en el estudio cómo comprar.', 'mp_not_connected');
  end if;

  if auth.uid() is not null then
    select id into v_student_id from public.students
    where studio_id = v_event.studio_id and user_id = auth.uid();
  end if;

  insert into public.event_orders (
    studio_id, event_id, ticket_type_id, quantity, buyer_name, buyer_email, buyer_phone, student_id,
    unit_price_cents, amount_cents, method, status, hold_expires_at, paid_at, created_by
  ) values (
    v_event.studio_id, v_event.id, v_type.id, p_quantity, v_name, v_email, v_phone, v_student_id,
    v_type.price_cents, v_amount,
    case when v_amount > 0 then 'mercadopago'::public.payment_method end,
    case when v_amount > 0 then 'pending' else 'paid' end::public.event_order_status,
    case when v_amount > 0 then now() + interval '20 minutes' end,
    case when v_amount = 0 then now() end,
    auth.uid()
  )
  returning * into v_order;

  if v_order.status = 'paid' then
    perform private.issue_event_tickets(v_order.id);
  end if;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Venta en la puerta (efectivo o transferencia), por el staff.
-- -----------------------------------------------------------------------------
create function public.sell_event_tickets_manual(
  p_ticket_type_id uuid,
  p_quantity integer,
  p_buyer_name text,
  p_method public.payment_method,
  p_buyer_email text default null,
  p_notes text default null
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
  v_email text := nullif(lower(btrim(coalesce(p_buyer_email, ''))), '');
begin
  select * into v_type from public.event_ticket_types where id = p_ticket_type_id for update;
  if not found then
    perform private.fail('No encontramos ese tipo de entrada.', 'ticket_type_not_found');
  end if;
  select * into v_event from public.events where id = v_type.event_id;

  if not (private.is_privileged() or private.is_studio_staff(v_event.studio_id)) then
    perform private.fail('Solo el staff del estudio puede vender entradas.', 'forbidden');
  end if;
  if v_event.status = 'cancelled' then
    perform private.fail('Este evento está cancelado.', 'event_cancelled');
  end if;
  if p_method is null or p_method = 'mercadopago' then
    perform private.fail('Elegí efectivo o transferencia.', 'invalid_method');
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    perform private.fail('Podés vender entre 1 y 20 entradas por vez.', 'invalid_quantity');
  end if;
  if char_length(btrim(coalesce(p_buyer_name, ''))) < 2 then
    perform private.fail('Poné el nombre de quien compra.', 'invalid_name');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.fail('Revisá el email.', 'invalid_email');
  end if;
  if v_type.quantity is not null
     and private.ticket_type_taken(v_type.id) + p_quantity > v_type.quantity then
    perform private.fail(
      format('Quedan %s entradas de este tipo.', greatest(v_type.quantity - private.ticket_type_taken(v_type.id), 0)),
      'not_enough_tickets'
    );
  end if;

  insert into public.event_orders (
    studio_id, event_id, ticket_type_id, quantity, buyer_name, buyer_email, unit_price_cents, amount_cents,
    method, status, paid_at, notes, created_by
  ) values (
    v_event.studio_id, v_event.id, v_type.id, p_quantity, btrim(p_buyer_name), v_email, v_type.price_cents,
    v_type.price_cents * p_quantity, p_method, 'paid', now(), nullif(btrim(coalesce(p_notes, '')), ''), auth.uid()
  )
  returning * into v_order;

  perform private.issue_event_tickets(v_order.id);
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Webhook de MP para una orden de entradas. Solo service role. Idempotente.
-- Si el pago llega después de vencida la reserva, igual se acepta (la plata
-- ya se cobró) y se deja una nota para que el estudio lo vea.
-- -----------------------------------------------------------------------------
create function public.mp_apply_event_payment(
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
  v_order public.event_orders%rowtype;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  select * into v_order from public.event_orders where external_reference = p_external_reference for update;
  if not found then
    perform private.fail('No encontramos esa compra.', 'order_not_found');
  end if;

  if v_order.status = 'paid' and v_order.mp_payment_id is distinct from p_mp_payment_id then
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'ignored', 'already_paid');
  end if;

  if p_mp_status = 'approved' then
    if p_amount_cents is distinct from v_order.amount_cents then
      update public.event_orders set notes = concat_ws(E'\n', notes,
        format('MP %s aprobado por %s centavos (esperado %s): revisar.', p_mp_payment_id, p_amount_cents, v_order.amount_cents))
      where id = v_order.id;
      return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'ignored', 'amount_mismatch');
    end if;

    if v_order.status <> 'paid' then
      update public.event_orders set
        status = 'paid',
        mp_payment_id = p_mp_payment_id,
        paid_at = coalesce(p_paid_at, now()),
        notes = case when v_order.status <> 'pending' or v_order.hold_expires_at <= now()
                     then concat_ws(E'\n', notes, 'Pago acreditado después de vencida la reserva: revisá el cupo.')
                     else notes end
      where id = v_order.id;
    end if;
    perform private.issue_event_tickets(v_order.id);
    return jsonb_build_object('order_id', v_order.id, 'status', 'paid');
  end if;

  if p_mp_status in ('refunded', 'charged_back') then
    if v_order.status = 'paid' then
      update public.event_orders set status = 'refunded' where id = v_order.id;
      update public.event_tickets set status = 'cancelled' where order_id = v_order.id;
    end if;
    return jsonb_build_object('order_id', v_order.id, 'status', 'refunded');
  end if;

  if p_mp_status in ('rejected', 'cancelled') and v_order.status = 'pending' then
    update public.event_orders set status = 'cancelled', mp_payment_id = p_mp_payment_id where id = v_order.id;
    return jsonb_build_object('order_id', v_order.id, 'status', 'cancelled');
  end if;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status);
end;
$$;

-- -----------------------------------------------------------------------------
-- "Tus entradas": lo ve quien tenga el link privado (sin cuenta).
-- -----------------------------------------------------------------------------
create function public.get_event_order(p_access_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'quantity', o.quantity,
    'buyer_name', o.buyer_name,
    'amount_cents', o.amount_cents,
    'ticket_type', t.name,
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'venue', e.venue, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'status', e.status
    ),
    'studio', jsonb_build_object('name', s.name, 'slug', s.slug, 'timezone', s.timezone),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'number', k.number, 'qr_token', k.qr_token, 'status', k.status, 'checked_in_at', k.checked_in_at
      ) order by k.number)
      from public.event_tickets k where k.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.event_orders o
  join public.events e on e.id = o.event_id
  join public.event_ticket_types t on t.id = o.ticket_type_id
  join public.studios s on s.id = o.studio_id
  where o.access_token = p_access_token;
$$;

-- -----------------------------------------------------------------------------
-- Control en la puerta.
-- -----------------------------------------------------------------------------
create function public.check_in_ticket(p_event_id uuid, p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio_id uuid;
  v_ticket public.event_tickets%rowtype;
  v_order public.event_orders%rowtype;
  v_type_name text;
  v_already boolean;
begin
  select studio_id into v_studio_id from public.events where id = p_event_id;
  if v_studio_id is null then
    perform private.fail('No encontramos ese evento.', 'event_not_found');
  end if;
  if not (private.is_privileged() or private.is_studio_staff(v_studio_id)) then
    perform private.fail('Solo el staff del estudio puede controlar entradas.', 'forbidden');
  end if;

  select * into v_ticket from public.event_tickets
  where qr_token = btrim(coalesce(p_qr_token, '')) and studio_id = v_studio_id
  for update;
  if not found then
    perform private.fail('Este QR no es una entrada del estudio.', 'ticket_not_found');
  end if;
  if v_ticket.event_id <> p_event_id then
    perform private.fail('Esta entrada es de otro evento.', 'wrong_event');
  end if;
  if v_ticket.status = 'cancelled' then
    perform private.fail('Esta entrada está cancelada.', 'ticket_cancelled');
  end if;

  v_already := v_ticket.checked_in_at is not null;
  if not v_already then
    update public.event_tickets set checked_in_at = now(), checked_in_by = auth.uid()
    where id = v_ticket.id
    returning * into v_ticket;
  end if;

  select * into v_order from public.event_orders where id = v_ticket.order_id;
  select name into v_type_name from public.event_ticket_types where id = v_ticket.ticket_type_id;

  return jsonb_build_object(
    'ticket_id', v_ticket.id,
    'already_checked_in', v_already,
    'checked_in_at', v_ticket.checked_in_at,
    'buyer_name', v_order.buyer_name,
    'ticket_type', v_type_name,
    'number', v_ticket.number,
    'quantity', v_order.quantity
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Cancelar una compra (el reintegro, si corresponde, lo hace el estudio).
-- -----------------------------------------------------------------------------
create function public.cancel_event_order(p_order_id uuid, p_reason text default null)
returns public.event_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.event_orders%rowtype;
begin
  select * into v_order from public.event_orders where id = p_order_id for update;
  if not found then
    perform private.fail('No encontramos esa compra.', 'order_not_found');
  end if;
  if not (private.is_privileged() or private.is_studio_admin(v_order.studio_id)) then
    perform private.fail('Solo el dueño del estudio puede cancelar entradas.', 'forbidden');
  end if;
  if v_order.status not in ('pending', 'paid') then
    perform private.fail('Esta compra ya no está activa.', 'order_not_active');
  end if;

  update public.event_orders set
    status = 'cancelled',
    notes = concat_ws(E'\n', notes, nullif(btrim(coalesce(p_reason, '')), ''))
  where id = v_order.id
  returning * into v_order;
  update public.event_tickets set status = 'cancelled' where order_id = v_order.id;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Libera las reservas vencidas (prolijidad: el cupo ya las ignora).
-- -----------------------------------------------------------------------------
create function public.expire_event_orders()
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
  update public.event_orders set status = 'expired'
  where status = 'pending' and hold_expires_at <= now() - interval '1 hour';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.event_availability(uuid) to anon, authenticated, service_role;
grant execute on function public.create_event_order(uuid, integer, text, text, text) to anon, authenticated;
grant execute on function public.sell_event_tickets_manual(uuid, integer, text, public.payment_method, text, text) to authenticated, service_role;
grant execute on function public.mp_apply_event_payment(uuid, text, text, bigint, timestamptz) to service_role;
grant execute on function public.get_event_order(text) to anon, authenticated, service_role;
grant execute on function public.check_in_ticket(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_event_order(uuid, text) to authenticated, service_role;
grant execute on function public.expire_event_orders() to service_role;

-- Cada 15 minutos. Se deja 1 hora de margen por si el pago de MP demora.
select cron.schedule('giroa_expire_event_orders', '*/15 * * * *', $$select public.expire_event_orders()$$);
