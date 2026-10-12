-- Bienvenida a un alumno cargado por el estudio: la pide el staff, una sola
-- vez, va al email de la ficha y nadie de afuera la puede disparar.
begin;
select plan(6);
select tests.fixture();

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.send_student_welcome('30000000-0000-0000-0000-0000000000a3')$$), 'student_not_found', 'un alumno no la puede mandar');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.send_student_welcome('30000000-0000-0000-0000-0000000000a3')$$), 'student_not_found', 'otro estudio tampoco');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.send_student_welcome('30000000-0000-0000-0000-0000000000a4')$$), 'no_email', 'sin email no se puede');

-- El profe se la manda a Carla (tiene email y no tiene cuenta).
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.send_student_welcome('30000000-0000-0000-0000-0000000000a3') as v$$) -> 0 ->> 'v', 'true', 'el staff se la manda');
select is((select to_address || '/' || status from public.notifications where dedupe_key = 'student_welcome:30000000-0000-0000-0000-0000000000a3'),
  'carla@test.com/pending', 'va a la cola con el email de la ficha');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.send_student_welcome('30000000-0000-0000-0000-0000000000a3') as v$$) -> 0 ->> 'v', 'false', 'una sola vez por alumno');

select * from finish();
rollback;
