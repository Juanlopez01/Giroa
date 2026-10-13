-- Certificados: requisitos (asistencia, evaluaciones, deuda), emitir (o emitir
-- igual), a todos los que cumplen, anular y volver a emitir, verificación
-- pública por código y quién ve qué.
begin;
select plan(18);
select tests.fixture();

-- En Estudio hay formaciones pero no certificados.
update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';
-- Profesorado con 4 encuentros ya dados (mínimo 75%) y un examen.
insert into public.formations (id, studio_id, title, starts_on, ends_on, status, min_attendance_pct,
  certificate_signer_name, certificate_signer_role, certificate_text)
values ('a0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Profesorado de Tango',
  current_date - 90, current_date - 1, 'published', 75, 'Lucía Ferrari', 'Directora', 'con una carga de 120 horas');
insert into public.formation_sessions (id, studio_id, formation_id, title, starts_at, ends_at)
select ('a2000000-0000-0000-0000-00000000000' || g)::uuid, '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1',
  'Encuentro ' || g, now() - make_interval(days => 10 * g), now() - make_interval(days => 10 * g) + interval '3 hours'
from generate_series(1, 4) g;
insert into public.formation_assessments (id, studio_id, formation_id, title, kind)
values ('a3000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'Examen final', 'grade');
-- Ana: 3 de 4 y aprobó. Beto: 1 de 4, no rindió. Carla: solo postulada.
insert into public.formation_enrollments (id, studio_id, formation_id, student_id, status) values
  ('a1000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', 'enrolled'),
  ('a1000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2', 'enrolled'),
  ('a1000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3', 'applied');
insert into public.formation_attendance (studio_id, formation_session_id, enrollment_id)
select '10000000-0000-0000-0000-00000000000a', ('a2000000-0000-0000-0000-00000000000' || g)::uuid, 'a1000000-0000-0000-0000-0000000000a1'
from generate_series(1, 3) g;
insert into public.formation_attendance (studio_id, formation_session_id, enrollment_id)
values ('10000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-0000000000a2');
insert into public.formation_grades (studio_id, assessment_id, enrollment_id, grade, passed)
values ('10000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 8, true);

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.issue_certificate('a1000000-0000-0000-0000-0000000000a1')$$), 'feature_unavailable', 'fuera del plan Pro no hay certificados');
update public.studios set plan = 'pro' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select string_agg(student_name || ':' || eligible || ':' || attendance_pct, ',') as v
    from public.certificate_status('a0000000-0000-0000-0000-0000000000a1')$$) -> 0 ->> 'v',
  'Ana:true:75,Beto:false:25', 'el panel ve quién cumple (sin la postulada)');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select reasons as v from public.certificate_status('a0000000-0000-0000-0000-0000000000a1') where student_name = 'Beto'$$) -> 0 -> 'v',
  '["Asistencia 25% (mínimo 75%).", "Falta aprobar: Examen final."]'::jsonb, 'y qué le falta a Beto');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select * from public.certificate_status('a0000000-0000-0000-0000-0000000000a1')$$), 'formation_not_found', 'un profe no');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.issue_certificate('a1000000-0000-0000-0000-0000000000a2')$$), 'not_eligible', 'a Beto no se le emite');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.issue_certificate('a1000000-0000-0000-0000-0000000000a3', true)$$), 'not_enrolled', 'a una postulada tampoco, ni forzando');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.issue_certificate('a1000000-0000-0000-0000-0000000000a1')$$), 'enrollment_not_found', 'un profe no emite');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.issue_certificate('a1000000-0000-0000-0000-0000000000a1')$$), 'enrollment_not_found', 'otro estudio tampoco');

-- A todos los que cumplen: solo Ana.
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.issue_certificates('a0000000-0000-0000-0000-0000000000a1') as v$$) -> 0 ->> 'v', '1', 'emite a la que cumple');
select is((select student_name || '/' || formation_title || '/' || signer_name || '/' || forced || '/' || (code ~ '^CERT-[A-Z2-9]{4}-[A-Z2-9]{4}$')
  from public.certificates where enrollment_id = 'a1000000-0000-0000-0000-0000000000a1'),
  'Ana/Profesorado de Tango/Lucía Ferrari/false/true', 'con copia de los datos y un código');
select is((select count(*)::integer from public.notifications where template = 'certificate_issued'
  and student_id = '30000000-0000-0000-0000-0000000000a1'), 1, 'y le avisa por mail');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.issue_certificate('a1000000-0000-0000-0000-0000000000a1')$$), 'already_issued', 'no se emite dos veces');

-- A Beto se lo emiten igual.
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select (public.issue_certificate('a1000000-0000-0000-0000-0000000000a2', true)).forced as v$$) -> 0 ->> 'v', 'true', 'emitir igual queda marcado');

-- Quién lo ve y verificación pública.
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', $$select 1 from public.certificates$$), 1, 'Ana ve solo el suyo');
select is(tests.q('anon', null,
  format($$select public.get_certificate(%L) ->> 'student_name' as v$$, lower((select code from public.certificates where student_id = '30000000-0000-0000-0000-0000000000a1')))) -> 0 ->> 'v',
  'Ana', 'cualquiera lo verifica con el código');

-- Anular y volver a emitir: código nuevo.
select set_config('t.old', (select code from public.certificates where student_id = '30000000-0000-0000-0000-0000000000a1'), false);
select tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select (public.revoke_certificate((select id from public.certificates where student_id = '30000000-0000-0000-0000-0000000000a1'), 'Error en el nombre')).id as v$$);
select is(tests.q('anon', null, format($$select public.get_certificate(%L) ->> 'revoked' as v$$, current_setting('t.old'))) -> 0 ->> 'v',
  'true', 'el anulado figura como anulado');
select isnt(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select (public.issue_certificate('a1000000-0000-0000-0000-0000000000a1')).code as v$$) -> 0 ->> 'v', current_setting('t.old'),
  'al volver a emitirlo, tiene otro código');
select is(tests.q('anon', null, format($$select public.get_certificate(%L) as v$$, current_setting('t.old'))) -> 0 ->> 'v', null,
  'y el código viejo ya no existe');

select * from finish();
rollback;
