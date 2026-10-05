-- =============================================================================
-- Alumnos. Un alumno pertenece a un estudio; user_id queda null hasta que la
-- persona se registra (join_studio lo vincula por email).
-- =============================================================================

create table public.students (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email = lower(email)),
  phone text check (char_length(phone) <= 40),
  default_role public.dance_role,
  is_active boolean not null default true,
  -- Lo que va en el QR de check-in. Aleatorio y rotable, nunca el id interno.
  qr_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, email),
  unique (studio_id, user_id),
  unique (studio_id, id)
);

create index students_user_idx on public.students (user_id) where user_id is not null;

create function private.students_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := btrim(new.full_name);
  new.email := nullif(lower(btrim(new.email)), '');
  new.phone := nullif(btrim(new.phone), '');
  return new;
end;
$$;

create trigger students_normalize before insert or update on public.students
  for each row execute function private.students_normalize();
create trigger students_updated_at before update on public.students
  for each row execute function private.set_updated_at();

-- Ids de alumno del usuario actual (uno por estudio).
create function private.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.students s where s.user_id = auth.uid()
$$;

grant execute on function private.my_student_ids() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- El staff gestiona los alumnos de su estudio. El alumno solo lee su ficha
-- (y la edita por RPC). user_id y qr_token solo los tocan funciones internas.
-- -----------------------------------------------------------------------------
alter table public.students enable row level security;
revoke all on public.students from anon, authenticated;

grant select, delete on public.students to authenticated;
grant insert (studio_id, full_name, email, phone, default_role, is_active)
  on public.students to authenticated;
grant update (full_name, email, phone, default_role, is_active)
  on public.students to authenticated;

create policy students_read on public.students for select to authenticated
  using (private.is_studio_staff(studio_id) or user_id = auth.uid());
create policy students_staff_insert on public.students for insert to authenticated
  with check (private.is_studio_staff(studio_id));
create policy students_staff_update on public.students for update to authenticated
  using (private.is_studio_staff(studio_id))
  with check (private.is_studio_staff(studio_id));
create policy students_admin_delete on public.students for delete to authenticated
  using (private.is_studio_admin(studio_id));

grant execute on function private.students_normalize() to authenticated, service_role;
