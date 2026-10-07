-- Foto de portada del estudio (página pública y app del alumno).
-- Se guarda en el bucket studio-assets como el logo: {studio_id}/cover-*.jpg
alter table public.studios add column cover_path text check (char_length(cover_path) <= 300);
grant update (cover_path) on public.studios to authenticated;

-- Las portadas pesan más que un logo: hasta 4 MB (el logo sigue limitado a 2 MB en la app).
update storage.buckets set file_size_limit = 4194304 where id = 'studio-assets';
