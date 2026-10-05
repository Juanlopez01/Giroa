-- =============================================================================
-- Tenancy: planes de Giroa, estudios, miembros del staff, suscripción y
-- catálogo global de disciplinas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Planes (catálogo global, editable solo por Giroa)
-- -----------------------------------------------------------------------------
create table public.plans (
  key public.studio_plan primary key,
  name text not null,
  monthly_price_cents bigint not null check (monthly_price_cents >= 0),
  max_active_students integer check (max_active_students > 0), -- null = ilimitado
  max_active_formations integer check (max_active_formations >= 0), -- null = ilimitado
  sort smallint not null
);

create table public.plan_features (
  plan public.studio_plan not null references public.plans (key) on delete cascade,
  feature text not null check (feature ~ '^[a-z][a-z0-9_]{1,60}$'),
  primary key (plan, feature)
);

-- -----------------------------------------------------------------------------
-- Estudios
-- -----------------------------------------------------------------------------
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9-]{3,40}$' and slug !~ '^-' and slug !~ '-$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  logo_path text,
  brand_color text not null default '#7a2e3a' check (brand_color ~ '^#[0-9a-f]{6}$'),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  cancel_window_hours smallint not null default 3 check (cancel_window_hours between 0 and 168),
  plan public.studio_plan not null default 'inicial' references public.plans (key),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger studios_updated_at before update on public.studios
  for each row execute function private.set_updated_at();

-- Subdominios que no pueden ser estudios.
create function private.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'www', 'app', 'api', 'admin',
    'mail', 'static', 'assets', 'cdn', 'status', 'help', 'ayuda',
    'docs', 'blog', 'soporte', 'giroa'
  ])
$$;

alter table public.studios
  add constraint studios_slug_not_reserved check (not private.is_reserved_slug(slug));

-- Valida contra el catálogo de zonas horarias de Postgres.
create function private.is_valid_timezone(p_tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz)
$$;

create function private.studios_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.brand_color := lower(new.brand_color);
  if not private.is_valid_timezone(new.timezone) then
    perform private.fail('La zona horaria no es válida.', 'invalid_timezone');
  end if;
  return new;
end;
$$;

create trigger studios_validate before insert or update on public.studios
  for each row execute function private.studios_validate();

-- -----------------------------------------------------------------------------
-- Staff del estudio
-- -----------------------------------------------------------------------------
create table public.studio_members (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  display_name text check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  unique (studio_id, user_id),
  unique (studio_id, id)
);

create index studio_members_user_idx on public.studio_members (user_id);

-- -----------------------------------------------------------------------------
-- Suscripción del estudio a Giroa (cobro manual al principio; preparado para
-- débito automático de MP a la cuenta de Giroa).
-- -----------------------------------------------------------------------------
create table public.studio_subscriptions (
  studio_id uuid primary key references public.studios (id) on delete cascade,
  status public.subscription_status not null default 'trialing',
  billing_cycle public.billing_cycle not null default 'monthly',
  founder_discount_pct smallint not null default 0 check (founder_discount_pct between 0 and 100),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  payment_method text not null default 'manual' check (payment_method in ('manual', 'mercadopago')),
  mp_preapproval_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger studio_subscriptions_updated_at before update on public.studio_subscriptions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Disciplinas (catálogo global). Agregar una disciplina = insertar una fila.
-- features: { "role_balance": bool, "couple_packs": bool,
--             "equipment_capacity": bool, "levels": bool }
-- -----------------------------------------------------------------------------
create table public.disciplines (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null,
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  sort smallint not null default 100,
  is_active boolean not null default true
);

-- -----------------------------------------------------------------------------
-- Helpers de autorización (security definer para evitar recursión en RLS).
-- -----------------------------------------------------------------------------
create function private.is_studio_staff(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio_id and m.user_id = auth.uid()
  )
$$;

create function private.is_studio_admin(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
$$;

grant execute on function private.is_studio_staff(uuid) to anon, authenticated, service_role;
grant execute on function private.is_studio_admin(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- -----------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
alter table public.studio_subscriptions enable row level security;
alter table public.disciplines enable row level security;

revoke all on public.plans, public.plan_features, public.studios, public.studio_members,
  public.studio_subscriptions, public.disciplines from anon, authenticated;

-- Catálogos: lectura pública.
grant select on public.plans, public.plan_features, public.disciplines to anon, authenticated;
create policy plans_read on public.plans for select to anon, authenticated using (true);
create policy plan_features_read on public.plan_features for select to anon, authenticated using (true);
create policy disciplines_read on public.disciplines for select to anon, authenticated using (true);

-- Estudios: públicos si están activos; el staff ve el suyo siempre.
-- Altas por RPC (create_studio). Owner/admin edita solo marca y configuración:
-- el plan y el estado los cambia Giroa (service role).
grant select on public.studios to anon, authenticated;
grant update (name, logo_path, brand_color, timezone, cancel_window_hours)
  on public.studios to authenticated;

create policy studios_read on public.studios for select to anon, authenticated
  using (is_active or private.is_studio_staff(id));
create policy studios_admin_update on public.studios for update to authenticated
  using (private.is_studio_admin(id))
  with check (private.is_studio_admin(id));

-- Miembros: cada usuario ve sus membresías; el staff ve a sus compañeros.
-- Altas y bajas por RPC.
grant select on public.studio_members to authenticated;
create policy studio_members_read on public.studio_members for select to authenticated
  using (user_id = auth.uid() or private.is_studio_staff(studio_id));

-- Suscripción: solo owner/admin la ven. Escribe solo Giroa.
grant select on public.studio_subscriptions to authenticated;
create policy studio_subscriptions_read on public.studio_subscriptions for select to authenticated
  using (private.is_studio_admin(studio_id));
