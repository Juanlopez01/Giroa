-- Reglas comerciales: plan inicial con 14 días de prueba y bloqueo de altas al
-- llegar al límite de alumnos activos (sin bloquear reservas).
begin;
select plan(10);
select tests.fixture();

-- ---------------------------------------------------------------- alta de estudio
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.create_studio('Tango Sur', 'tango-sur')$$);
select is((select plan::text from public.studios where slug = 'tango-sur'), 'inicial',
  'todo estudio nuevo arranca en Inicial');
select ok((select trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour'
  from public.studio_subscriptions ss join public.studios s on s.id = ss.studio_id where s.slug = 'tango-sur'),
  'con 14 días de prueba');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.create_studio('Otro', 'otro-estudio', 'pro')$$), '42883',
  'no se puede elegir el plan al registrarse');

-- ---------------------------------------------------------------- límite de alumnos
-- El estudio A tiene 5 alumnos activos (todos con pack). Lo llevamos a un plan con límite 5.
update public.plans set max_active_students = 5 where key = 'profe';
update public.studios set plan = 'profe' where id = '10000000-0000-0000-0000-00000000000a';

select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.studio_usage('10000000-0000-0000-0000-00000000000a') as u$$) -> 0 -> 'u' ->> 'at_limit'),
  'true', 'el panel sabe que está en el límite');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.students (studio_id, full_name) values ('10000000-0000-0000-0000-00000000000a', 'Nueva')$$),
  'plan_limit_reached', 'el staff no puede dar de alta alumnos nuevos');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.join_studio('estudio-a', 'Alguien nuevo')$$),
  'plan_limit_reached', 'un alumno nuevo no puede sumarse desde la app');

select tests.create_user('00000000-0000-0000-0000-0000000000a5', 'carla@test.com');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a5',
  $$select public.join_studio('estudio-a', 'Carla')$$),
  'OK', 'vincular un perfil ya cargado no cuenta como alta');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1')$$),
  'OK', 'los alumnos existentes siguen reservando');

-- Un alumno deja de estar activo (sin pack ni asistencia): se libera un lugar.
update public.student_packs set status = 'expired' where id = '70000000-0000-0000-0000-0000000000a5';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.students (studio_id, full_name) values ('10000000-0000-0000-0000-00000000000a', 'Nueva')$$),
  'OK', 'con un lugar libre se puede dar de alta de nuevo');

select is(public.studio_has_feature('10000000-0000-0000-0000-00000000000a', 'mp_checkout'), true,
  'el límite no cambia las features del plan');

select * from finish();
rollback;
