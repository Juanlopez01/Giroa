-- Material de formaciones: lo ven el staff y los inscriptos al día; con deuda,
-- postulados o de otro estudio, no. Los archivos del bucket privado, igual.
begin;
select plan(15);
select tests.fixture();

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

insert into public.formations (id, studio_id, title, starts_on, ends_on, status)
values ('a0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Profesorado',
        current_date, current_date + 300, 'published');
-- Ana inscripta; Beto solo postulado.
insert into public.formation_enrollments (id, studio_id, formation_id, student_id, status) values
  ('a1000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a',
   'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', 'enrolled'),
  ('a1000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a',
   'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2', 'applied');

-- El profe carga un link y el dueño un archivo.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$insert into public.formation_materials (studio_id, formation_id, title, kind, url)
    values ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Video de técnica', 'link', 'https://youtu.be/x')$$),
  'OK', 'el profe carga un link');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.formation_materials (studio_id, formation_id, title, kind, storage_path, mime_type, size_bytes)
    values ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Apunte 1', 'file',
            '10000000-0000-0000-0000-00000000000a/a0000000-0000-0000-0000-0000000000a1/apunte.pdf', 'application/pdf', 1000)$$),
  'OK', 'el dueño carga un archivo');
select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.formation_materials (studio_id, formation_id, title, kind, storage_path)
    values ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Fuera de carpeta', 'file',
            '10000000-0000-0000-0000-00000000000b/otra/apunte.pdf')$$),
  'OK', 'el archivo tiene que estar en la carpeta de la formación');
select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$insert into public.formation_materials (studio_id, formation_id, title, kind, url)
    values ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Trucho', 'link', 'https://x.com')$$),
  'OK', 'un alumno no puede cargar material');
select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$insert into public.formation_materials (studio_id, formation_id, title, kind, url)
    values ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'De otro', 'link', 'https://x.com')$$),
  'OK', 'el dueño de otro estudio no puede cargar material');

select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from public.formation_materials$$), 2, 'la inscripta al día ve el material');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select 1 from public.formation_materials$$), 0, 'el postulado todavía no lo ve');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select 1 from public.formation_materials$$), 0, 'otro estudio no lo ve');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select 1 from public.formation_materials$$), 0, 'alguien sin estudio no lo ve');
select isnt(tests.err('anon', null, $$select 1 from public.formation_materials$$), 'OK', 'sin sesión no se ve');

-- El archivo en el bucket privado.
insert into storage.objects (bucket_id, name)
values ('formation-materials', '10000000-0000-0000-0000-00000000000a/a0000000-0000-0000-0000-0000000000a1/apunte.pdf');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from storage.objects where bucket_id = 'formation-materials'$$), 1, 'la inscripta puede abrir el archivo');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select 1 from storage.objects where bucket_id = 'formation-materials'$$), 0, 'el postulado no puede abrir el archivo');

-- Con una cuota vencida, deja de verlo.
insert into public.formation_charges (studio_id, enrollment_id, formation_id, kind, amount_cents, due_on)
values ('10000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1',
        'a0000000-0000-0000-0000-0000000000a1', 'installment', 100000, (current_date - interval '2 months')::date);
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from public.formation_materials$$), 0, 'con deuda no ve el material');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from storage.objects where bucket_id = 'formation-materials'$$), 0, 'con deuda no puede abrir el archivo');

select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select 1 from public.formation_materials$$), 2, 'el profe ve todo el material');

select * from finish();
rollback;
