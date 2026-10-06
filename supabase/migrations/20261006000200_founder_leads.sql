-- =============================================================================
-- Contactos de la landing ("Quiero ser estudio fundador"). Tabla de Giroa, no
-- de un estudio: RLS activado y sin políticas; solo escribe el servidor
-- (service role) después de validar el formulario.
-- =============================================================================

create table public.founder_leads (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 40),
  studio_name text check (char_length(studio_name) <= 120),
  kind text not null check (kind in ('studio', 'teacher')),
  disciplines text check (char_length(disciplines) <= 200),
  students_count text check (char_length(students_count) <= 40),
  message text check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.founder_leads enable row level security;
revoke all on public.founder_leads from anon, authenticated;
