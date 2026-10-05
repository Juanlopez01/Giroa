-- =============================================================================
-- Productos de pack, pagos, packs del alumno (saldo) e historial de créditos.
-- Los packs valen para todas las clases regulares del estudio.
-- =============================================================================

create table public.pack_products (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (char_length(description) <= 1000),
  credits integer check (credits between 1 and 1000), -- null = ilimitado
  validity_days smallint not null check (validity_days between 1 and 730),
  price_cents bigint not null check (price_cents >= 0),
  -- Pack de pareja: saldo compartido entre dos alumnos (requiere couple_packs).
  is_couple boolean not null default false,
  is_active boolean not null default true,
  sort smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id)
);

create trigger pack_products_updated_at before update on public.pack_products
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Pagos. Un pago siempre va a una sola cuenta (la del estudio).
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  student_id uuid not null,
  partner_student_id uuid,
  purpose public.payment_purpose not null default 'pack',
  pack_product_id uuid,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  -- Lo que viaja a MP como external_reference.
  external_reference uuid not null unique default gen_random_uuid(),
  mp_preference_id text,
  mp_payment_id text unique,
  -- Comisión de Giroa (marketplace_fee). Preparado, en 0 por ahora.
  marketplace_fee_cents bigint not null default 0 check (marketplace_fee_cents >= 0),
  paid_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  check (purpose <> 'pack' or pack_product_id is not null),
  check (partner_student_id is null or partner_student_id <> student_id),
  check (status <> 'approved' or paid_at is not null),
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete restrict,
  foreign key (studio_id, partner_student_id) references public.students (studio_id, id) on delete restrict,
  foreign key (studio_id, pack_product_id) references public.pack_products (studio_id, id) on delete restrict
);

create index payments_studio_created_idx on public.payments (studio_id, created_at desc);
create index payments_student_idx on public.payments (student_id);

create trigger payments_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Packs del alumno (saldo). credits_used es cache; la verdad está en
-- pack_credit_events.
-- -----------------------------------------------------------------------------
create table public.student_packs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  student_id uuid not null,
  partner_student_id uuid,
  pack_product_id uuid,
  payment_id uuid unique,
  name text not null, -- copia del nombre del producto al momento de la compra
  credits_total integer check (credits_total >= 0), -- null = ilimitado
  credits_used integer not null default 0 check (credits_used >= 0),
  starts_at timestamptz not null default now(),
  -- Primer instante en que el pack ya no vale (medianoche local del día siguiente
  -- al último día válido).
  expires_at timestamptz not null,
  status public.pack_status not null default 'active',
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  check (credits_total is null or credits_used <= credits_total),
  check (expires_at > starts_at),
  check (partner_student_id is null or partner_student_id <> student_id),
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete restrict,
  foreign key (studio_id, partner_student_id) references public.students (studio_id, id) on delete restrict,
  foreign key (studio_id, pack_product_id) references public.pack_products (studio_id, id) on delete set null (pack_product_id),
  foreign key (studio_id, payment_id) references public.payments (studio_id, id) on delete restrict
);

create index student_packs_student_idx on public.student_packs (student_id, expires_at) where status = 'active';
create index student_packs_partner_idx on public.student_packs (partner_student_id, expires_at)
  where status = 'active' and partner_student_id is not null;
create index student_packs_expiry_idx on public.student_packs (expires_at) where status = 'active';

create trigger student_packs_updated_at before update on public.student_packs
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Historial de créditos ("¿por qué me descontaron una clase?").
-- booking_id se agrega como FK en la migración de reservas.
-- -----------------------------------------------------------------------------
create table public.pack_credit_events (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios (id) on delete cascade,
  student_pack_id uuid not null,
  booking_id uuid,
  kind public.credit_event_kind not null,
  delta integer not null,
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (studio_id, student_pack_id) references public.student_packs (studio_id, id) on delete cascade
);

create index pack_credit_events_pack_idx on public.pack_credit_events (student_pack_id, created_at);

-- -----------------------------------------------------------------------------
-- RLS
-- Productos: públicos si están activos; owner/admin los gestionan.
-- Pagos: owner/admin y el propio alumno. Packs y créditos: staff (los profes
-- ven el saldo al tomar asistencia) y el propio alumno (o su pareja).
-- Escrituras de pagos, packs y créditos: solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.pack_products enable row level security;
alter table public.payments enable row level security;
alter table public.student_packs enable row level security;
alter table public.pack_credit_events enable row level security;

revoke all on public.pack_products, public.payments, public.student_packs,
  public.pack_credit_events from anon, authenticated;

grant select on public.pack_products to anon, authenticated;
grant insert, update, delete on public.pack_products to authenticated;
grant select on public.payments, public.student_packs, public.pack_credit_events to authenticated;

create policy pack_products_read on public.pack_products for select to anon, authenticated
  using (is_active or private.is_studio_staff(studio_id));
create policy pack_products_admin_insert on public.pack_products for insert to authenticated
  with check (private.is_studio_admin(studio_id));
create policy pack_products_admin_update on public.pack_products for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy pack_products_admin_delete on public.pack_products for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy payments_read on public.payments for select to authenticated
  using (
    private.is_studio_admin(studio_id)
    or student_id in (select private.my_student_ids())
    or partner_student_id in (select private.my_student_ids())
  );

create policy student_packs_read on public.student_packs for select to authenticated
  using (
    private.is_studio_staff(studio_id)
    or student_id in (select private.my_student_ids())
    or partner_student_id in (select private.my_student_ids())
  );

create policy pack_credit_events_read on public.pack_credit_events for select to authenticated
  using (
    private.is_studio_staff(studio_id)
    or exists (
      select 1 from public.student_packs sp
      where sp.id = student_pack_id
        and (sp.student_id in (select private.my_student_ids())
             or sp.partner_student_id in (select private.my_student_ids()))
    )
  );
