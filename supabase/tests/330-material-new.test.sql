-- Aviso de material nuevo: solo a quien lo puede ver (biblioteca para todos o
-- con pack; formación, inscriptos sin deuda), una vez por material y alumno, y
-- solo lo dispara el staff del estudio.
begin;
select plan(7);
select tests.fixture();

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';
insert into public.library_items (id, studio_id, title, kind, url, audience) values
  ('b0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Calentamiento', 'link', 'https://youtu.be/x', 'all'),
  ('b0000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'Rutina', 'link', 'https://youtu.be/y', 'pack');
-- Beto se quedó sin pack.
update public.student_packs set status = 'expired', starts_at = now() - interval '31 days', expires_at = now() - interval '1 day' where id = '70000000-0000-0000-0000-0000000000a2';

select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.notify_new_material('library', 'b0000000-0000-0000-0000-0000000000a1') as v$$) -> 0 ->> 'v',
  (select count(*)::text from public.students where studio_id = '10000000-0000-0000-0000-00000000000a' and is_active and email is not null),
  'para todos: a los alumnos activos con email');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.notify_new_material('library', 'b0000000-0000-0000-0000-0000000000a1') as v$$) -> 0 ->> 'v', '0',
  'dos veces no repite');
select is((select count(*)::integer from public.notifications
  where template = 'material_new' and payload ->> 'title' = 'Rutina'
    and student_id = '30000000-0000-0000-0000-0000000000a2'), 0, 'precondición');
select tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.notify_new_material('library', 'b0000000-0000-0000-0000-0000000000a2') as v$$);
select ok(not exists (select 1 from public.notifications where dedupe_key = 'material_new:b0000000-0000-0000-0000-0000000000a2:30000000-0000-0000-0000-0000000000a2')
  and exists (select 1 from public.notifications where dedupe_key = 'material_new:b0000000-0000-0000-0000-0000000000a2:30000000-0000-0000-0000-0000000000a1'),
  'con pack: a Ana sí, a Beto (sin pack) no');

-- Formación: Ana inscripta, Beto solo postulado.
insert into public.formations (id, studio_id, title, starts_on, ends_on, status)
values ('a0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Profesorado', current_date, current_date + 300, 'published');
insert into public.formation_enrollments (id, studio_id, formation_id, student_id, status) values
  ('a1000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', 'enrolled'),
  ('a1000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2', 'applied');
insert into public.formation_materials (id, studio_id, formation_id, title, kind, url)
values ('c0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Apunte 1', 'link', 'https://x.com/a');

select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.notify_new_material('formation', 'c0000000-0000-0000-0000-0000000000a1') as v$$) -> 0 ->> 'v', '1',
  'formación: solo a la inscripta');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.notify_new_material('library', 'b0000000-0000-0000-0000-0000000000a1')$$), 'material_not_found', 'un alumno no lo dispara');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.notify_new_material('formation', 'c0000000-0000-0000-0000-0000000000a1')$$), 'material_not_found', 'otro estudio tampoco');

select * from finish();
rollback;
