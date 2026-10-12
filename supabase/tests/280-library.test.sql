-- Biblioteca: el staff carga; los alumnos ven lo de "todos", y lo de "con pack"
-- solo si tienen un pack vigente. Otro estudio, nada. Los archivos, igual.
begin;
select plan(12);
select tests.fixture();

select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.library_items (studio_id, title, kind, url)
    values ('10000000-0000-0000-0000-00000000000a', 'Sin plan', 'link', 'https://youtu.be/x')$$),
  'OK', 'en el plan Inicial no hay biblioteca');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$insert into public.library_items (studio_id, title, kind, url, audience)
    values ('10000000-0000-0000-0000-00000000000a', 'Calentamiento', 'link', 'https://youtu.be/x', 'all')$$),
  'OK', 'el profe carga un link para todos');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.library_items (studio_id, title, kind, storage_path, mime_type, size_bytes, audience)
    values ('10000000-0000-0000-0000-00000000000a', 'Rutina en casa', 'file',
            '10000000-0000-0000-0000-00000000000a/rutina.pdf', 'application/pdf', 1000, 'pack')$$),
  'OK', 'el dueño carga un archivo solo para los que tienen pack');
select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.library_items (studio_id, title, kind, storage_path)
    values ('10000000-0000-0000-0000-00000000000a', 'Fuera', 'file', '10000000-0000-0000-0000-00000000000b/x.pdf')$$),
  'OK', 'el archivo tiene que estar en la carpeta del estudio');
select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$insert into public.library_items (studio_id, title, kind, url)
    values ('10000000-0000-0000-0000-00000000000a', 'Trucho', 'link', 'https://x.com')$$),
  'OK', 'un alumno no carga material');

-- Ana tiene pack: ve los dos. Beto se quedó sin pack: solo el de todos.
update public.student_packs set credits_used = credits_total where id = '70000000-0000-0000-0000-0000000000a2';
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', $$select 1 from public.library_items$$), 2,
  'Ana (con pack) ve todo');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4', $$select 1 from public.library_items$$), 1,
  'Beto (sin pack) ve solo lo que es para todos');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b3', $$select 1 from public.library_items$$), 0,
  'un alumno de otro estudio no ve nada');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000c1', $$select 1 from public.library_items$$), 0,
  'un usuario sin estudio tampoco');

-- Archivos del bucket privado.
insert into storage.objects (bucket_id, name) values ('library', '10000000-0000-0000-0000-00000000000a/rutina.pdf');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from storage.objects where bucket_id = 'library'$$), 1, 'Ana puede abrir el archivo');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select 1 from storage.objects where bucket_id = 'library'$$), 0, 'Beto no');

-- Si el estudio baja de plan, los alumnos dejan de verla.
update public.studios set plan = 'inicial' where id = '10000000-0000-0000-0000-00000000000a';
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', $$select 1 from public.library_items$$), 0,
  'sin el plan, los alumnos no la ven');

select * from finish();
rollback;
