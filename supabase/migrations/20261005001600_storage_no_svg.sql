-- Los logos no aceptan SVG: un SVG puede llevar scripts.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'studio-assets';
