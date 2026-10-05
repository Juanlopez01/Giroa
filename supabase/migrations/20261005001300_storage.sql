-- =============================================================================
-- Storage: bucket público para la marca del estudio (logo).
-- Ruta: <studio_id>/<archivo>. Solo owner/admin del estudio escriben.
-- (El material de la biblioteca, en la Fase 2, va en un bucket privado con
-- URLs firmadas.)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-assets', 'studio-assets', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

create function private.storage_studio_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy studio_assets_admin_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'studio-assets'
    and private.is_studio_admin(private.storage_studio_id(name))
  );

create policy studio_assets_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'studio-assets'
    and private.is_studio_admin(private.storage_studio_id(name))
  )
  with check (
    bucket_id = 'studio-assets'
    and private.is_studio_admin(private.storage_studio_id(name))
  );

create policy studio_assets_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'studio-assets'
    and private.is_studio_admin(private.storage_studio_id(name))
  );

grant execute on function private.storage_studio_id(text) to authenticated, service_role;
