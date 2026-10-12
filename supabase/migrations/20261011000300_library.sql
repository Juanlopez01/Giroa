-- =============================================================================
-- Biblioteca (feature 'library', Estudio y Pro): material para los alumnos del
-- estudio (no solo los de una formación): archivos (PDF, imagen, audio) o
-- links (YouTube, Drive).
--
-- Cada ítem dice quién lo ve: todos los alumnos activos ('all') o solo los que
-- tienen un pack vigente ('pack'). Los archivos van en un bucket PRIVADO y el
-- alumno los abre con una URL firmada que vence en minutos.
-- Ruta en el bucket: <studio_id>/<archivo>.
-- =============================================================================

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 1000),
  audience text not null default 'all' check (audience in ('all', 'pack')),
  kind text not null check (kind in ('file', 'link')),
  storage_path text unique check (char_length(storage_path) <= 400),
  mime_type text check (char_length(mime_type) <= 120),
  size_bytes bigint check (size_bytes between 1 and 52428800),
  url text check (url ~ '^https://' and char_length(url) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind = 'file' and storage_path is not null and url is null)
    or (kind = 'link' and url is not null and storage_path is null)
  ),
  check (storage_path is null or storage_path like studio_id::text || '/%'),
  unique (studio_id, id)
);

create index library_items_studio_idx on public.library_items (studio_id, created_at desc);

-- ¿El usuario (alumno) puede ver un ítem con esta audiencia en este estudio?
create function private.library_access(p_studio_id uuid, p_audience text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.studio_has_feature(p_studio_id, 'library') and exists (
    select 1 from public.students s
    where s.studio_id = p_studio_id
      and s.user_id = auth.uid()
      and s.is_active
      and (
        p_audience = 'all'
        or exists (
          select 1 from public.student_balances b
          where b.studio_id = p_studio_id and b.is_usable
            and (b.student_id = s.id or b.partner_student_id = s.id)
        )
      )
  )
$$;

revoke execute on function private.library_access(uuid, text) from public, anon;
grant execute on function private.library_access(uuid, text) to authenticated, service_role;

alter table public.library_items enable row level security;
revoke all on public.library_items from anon, authenticated;
grant select, insert, update, delete on public.library_items to authenticated;

create policy library_items_read on public.library_items for select to authenticated
  using (private.is_studio_staff(studio_id) or private.library_access(studio_id, audience));
-- La cargan el dueño, los encargados y los profes.
create policy library_items_staff_insert on public.library_items for insert to authenticated
  with check (private.is_studio_staff(studio_id) and public.studio_has_feature(studio_id, 'library'));
create policy library_items_staff_update on public.library_items for update to authenticated
  using (private.is_studio_staff(studio_id)) with check (private.is_studio_staff(studio_id));
create policy library_items_staff_delete on public.library_items for delete to authenticated
  using (private.is_studio_staff(studio_id));

-- -----------------------------------------------------------------------------
-- Bucket privado (50 MB por archivo): PDF, imágenes y audio. Videos: link.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library', 'library', false, 52428800,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg'
  ]
)
on conflict (id) do nothing;

create policy library_staff_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'library' and private.is_studio_staff(private.storage_studio_id(name)));

create policy library_staff_remove on storage.objects for delete to authenticated
  using (bucket_id = 'library' and private.is_studio_staff(private.storage_studio_id(name)));

create policy library_read_file on storage.objects for select to authenticated
  using (
    bucket_id = 'library'
    and (
      private.is_studio_staff(private.storage_studio_id(name))
      or exists (
        select 1 from public.library_items i
        where i.storage_path = objects.name and private.library_access(i.studio_id, i.audience)
      )
    )
  );
