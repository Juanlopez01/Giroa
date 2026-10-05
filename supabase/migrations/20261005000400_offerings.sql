-- =============================================================================
-- Actividades (offerings), horarios semanales y sesiones concretas.
-- =============================================================================

create table public.offerings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  discipline_key text not null references public.disciplines (key),
  kind public.offering_kind not null default 'regular',
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 4000),
  level text check (char_length(level) <= 60),
  teacher_member_id uuid,
  -- Nombre a mostrar del profe (también para invitados sin cuenta).
  teacher_name text check (char_length(teacher_name) <= 120),
  capacity integer not null check (capacity between 1 and 1000),
  -- null = sin balance de roles. Con 0 nadie podría reservar, por eso >= 1.
  role_balance_max_diff smallint check (role_balance_max_diff >= 1),
  price_cents bigint check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  foreign key (studio_id, teacher_member_id)
    references public.studio_members (studio_id, id) on delete set null (teacher_member_id)
);

create index offerings_studio_idx on public.offerings (studio_id) where is_active;

create trigger offerings_updated_at before update on public.offerings
  for each row execute function private.set_updated_at();

-- weekday: 0 = domingo … 6 = sábado (igual que extract(dow)).
-- start_time es hora local del estudio.
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  offering_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_minutes smallint not null check (duration_minutes between 15 and 600),
  valid_from date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (studio_id, id),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  foreign key (studio_id, offering_id)
    references public.offerings (studio_id, id) on delete cascade
);

create index class_schedules_offering_idx on public.class_schedules (offering_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  offering_id uuid not null,
  schedule_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity_override integer check (capacity_override between 1 and 1000),
  status public.session_status not null default 'scheduled',
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (studio_id, id),
  -- Regenerar desde los horarios nunca duplica.
  unique (schedule_id, starts_at),
  foreign key (studio_id, offering_id)
    references public.offerings (studio_id, id) on delete cascade,
  foreign key (studio_id, schedule_id)
    references public.class_schedules (studio_id, id) on delete set null (schedule_id)
);

create index sessions_studio_starts_idx on public.sessions (studio_id, starts_at);
create index sessions_offering_starts_idx on public.sessions (offering_id, starts_at);

-- -----------------------------------------------------------------------------
-- RLS: la grilla es pública. Owner/admin la gestionan; los profes la leen.
-- -----------------------------------------------------------------------------
alter table public.offerings enable row level security;
alter table public.class_schedules enable row level security;
alter table public.sessions enable row level security;

revoke all on public.offerings, public.class_schedules, public.sessions from anon, authenticated;
grant select on public.offerings, public.class_schedules, public.sessions to anon, authenticated;
grant insert, update, delete on public.offerings, public.class_schedules to authenticated;
-- El estado de la sesión se cambia por RPC (cancel_session devuelve los créditos).
grant insert, delete on public.sessions to authenticated;
grant update (starts_at, ends_at, capacity_override, notes) on public.sessions to authenticated;

create policy offerings_read on public.offerings for select to anon, authenticated
  using (is_active or private.is_studio_staff(studio_id));
create policy offerings_admin_insert on public.offerings for insert to authenticated
  with check (private.is_studio_admin(studio_id));
create policy offerings_admin_update on public.offerings for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy offerings_admin_delete on public.offerings for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy class_schedules_read on public.class_schedules for select to anon, authenticated
  using (true);
create policy class_schedules_admin_insert on public.class_schedules for insert to authenticated
  with check (private.is_studio_admin(studio_id));
create policy class_schedules_admin_update on public.class_schedules for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy class_schedules_admin_delete on public.class_schedules for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy sessions_read on public.sessions for select to anon, authenticated
  using (true);
create policy sessions_admin_insert on public.sessions for insert to authenticated
  with check (private.is_studio_admin(studio_id));
create policy sessions_admin_update on public.sessions for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy sessions_admin_delete on public.sessions for delete to authenticated
  using (private.is_studio_admin(studio_id));
