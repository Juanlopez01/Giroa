-- =============================================================================
-- Material de las formaciones: archivos (PDF, imágenes, audio) o links
-- (YouTube, Drive), de toda la formación o de un encuentro puntual.
--
-- Lo ven solo los inscriptos al día (si deben una cuota, no lo ven hasta pagar,
-- igual que la asistencia) y el staff. Los archivos van en un bucket PRIVADO:
-- el alumno los abre con una URL firmada que vence en minutos.
-- Ruta en el bucket: <studio_id>/<formation_id>/<archivo>.
-- =============================================================================

create table public.formation_materials (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  formation_id uuid not null,
  -- null = material de toda la formación.
  session_id uuid,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 1000),
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
  -- El archivo tiene que estar en la carpeta de su estudio y su formación.
  check (storage_path is null or storage_path like studio_id::text || '/' || formation_id::text || '/%'),
  unique (studio_id, id),
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade,
  foreign key (studio_id, session_id) references public.formation_sessions (studio_id, id) on delete set null (session_id)
);

create index formation_materials_formation_idx on public.formation_materials (formation_id, created_at);

-- ¿El usuario puede ver el material de esta formación? (inscripto y sin deuda)
create function private.formation_material_access(p_formation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.formation_enrollments e
    where e.formation_id = p_formation_id
      and e.status = 'enrolled'
      and e.student_id in (select private.my_student_ids())
      and not private.enrollment_in_debt(e.id)
  )
$$;

revoke execute on function private.formation_material_access(uuid) from public, anon;
grant execute on function private.formation_material_access(uuid) to authenticated, service_role;

alter table public.formation_materials enable row level security;
revoke all on public.formation_materials from anon, authenticated;
grant select, insert, update, delete on public.formation_materials to authenticated;

create policy formation_materials_read on public.formation_materials for select to authenticated
  using (private.is_studio_staff(studio_id) or private.formation_material_access(formation_id));
-- Lo cargan el dueño, los encargados y los profes (es material de clase).
create policy formation_materials_staff_insert on public.formation_materials for insert to authenticated
  with check (private.is_studio_staff(studio_id) and public.studio_has_feature(studio_id, 'formations'));
create policy formation_materials_staff_update on public.formation_materials for update to authenticated
  using (private.is_studio_staff(studio_id)) with check (private.is_studio_staff(studio_id));
create policy formation_materials_staff_delete on public.formation_materials for delete to authenticated
  using (private.is_studio_staff(studio_id));

-- -----------------------------------------------------------------------------
-- Bucket privado (50 MB por archivo): PDF, imágenes y audio. Videos: link.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'formation-materials', 'formation-materials', false, 52428800,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg'
  ]
)
on conflict (id) do nothing;

create policy formation_materials_staff_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'formation-materials'
    and private.is_studio_staff(private.storage_studio_id(name))
  );

create policy formation_materials_staff_remove on storage.objects for delete to authenticated
  using (
    bucket_id = 'formation-materials'
    and private.is_studio_staff(private.storage_studio_id(name))
  );

-- Leer (y por lo tanto firmar una URL): el staff, o el inscripto al día de un
-- material cargado con esa ruta.
create policy formation_materials_read_file on storage.objects for select to authenticated
  using (
    bucket_id = 'formation-materials'
    and (
      private.is_studio_staff(private.storage_studio_id(name))
      or exists (
        select 1 from public.formation_materials m
        where m.storage_path = objects.name and private.formation_material_access(m.formation_id)
      )
    )
  );
