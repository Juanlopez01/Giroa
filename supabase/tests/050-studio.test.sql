-- create_studio, check_slug, join_studio, generate_sessions, grilla pública y gating.
begin;
select plan(26);
select tests.fixture();

-- ---------------------------------------------------------------- slugs
select is(public.check_slug('tango-sur'), 'available', 'slug libre');
select is(public.check_slug('estudio-a'), 'taken', 'slug ocupado');
select is(public.check_slug('admin'), 'reserved', 'slug reservado');
select is(public.check_slug('Tango Sur'), 'invalid', 'mayúsculas y espacios no valen');
select is(public.check_slug('-tango'), 'invalid', 'no puede empezar con guion');

-- ---------------------------------------------------------------- create_studio
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.create_studio('Tango Sur', 'tango-sur')$$), 'OK',
  'un usuario crea su estudio');
select is((select role::text from public.studio_members m join public.studios s on s.id = m.studio_id
  where s.slug = 'tango-sur' and m.user_id = '00000000-0000-0000-0000-0000000000c1'),
  'owner', 'queda como owner');
select is((select status::text from public.studio_subscriptions ss join public.studios s on s.id = ss.studio_id
  where s.slug = 'tango-sur'), 'trialing', 'arranca con la suscripción en prueba');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.create_studio('Otro', 'tango-sur')$$), 'slug_taken',
  'no se puede repetir el slug');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.create_studio('Otro', 'www')$$), 'slug_reserved',
  'no se puede usar un subdominio reservado');
select is(tests.err('anon', null,
  $$select public.create_studio('Otro', 'otro-estudio')$$), '42501',
  'un anónimo no puede crear estudios');

-- ---------------------------------------------------------------- join_studio
-- Carla fue cargada por el estudio con su email; ahora se registra.
select tests.create_user('00000000-0000-0000-0000-0000000000a5', 'Carla@Test.com');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a5',
  $$select public.join_studio('estudio-a', 'Carla López', '11 5555-5555', 'leader')$$), 'OK',
  'Carla se suma al estudio A');
select is((select user_id from public.students where id = '30000000-0000-0000-0000-0000000000a3'),
  '00000000-0000-0000-0000-0000000000a5'::uuid, 'se vincula al perfil que ya existía (por email)');
select is((select count(*)::integer from public.students where studio_id = '10000000-0000-0000-0000-00000000000a'), 5,
  'no se duplica el alumno');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a5',
  $$select public.join_studio('estudio-a', 'Carla López')$$), 'OK',
  'sumarse de nuevo no falla');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.join_studio('estudio-b', 'Nadie', null, 'follower')$$), 'OK',
  'un usuario nuevo se suma a B');
select is((select count(*)::integer from public.students where user_id = '00000000-0000-0000-0000-0000000000c1'), 1,
  'se crea su ficha de alumno');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.join_studio('no-existe', 'Nadie')$$), 'studio_not_found',
  'estudio inexistente');

-- ---------------------------------------------------------------- generate_sessions
insert into public.class_schedules (studio_id, offering_id, weekday, start_time, duration_minutes) values
  ('10000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000a1', 1, '19:00', 90),
  ('10000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000a1', 3, '20:30', 90);

select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.generate_sessions('10000000-0000-0000-0000-00000000000a', (current_date + 1), 4) as n$$) -> 0 ->> 'n'),
  '8', 'genera 2 clases por semana durante 4 semanas');
select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.generate_sessions('10000000-0000-0000-0000-00000000000a', (current_date + 1), 4) as n$$) -> 0 ->> 'n'),
  '0', 'volver a generar no duplica');
select is((select to_char(starts_at at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI')
  from public.sessions s join public.class_schedules cs on cs.id = s.schedule_id
  where cs.weekday = 1 limit 1), '19:00', 'la hora se respeta en la zona horaria del estudio');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.generate_sessions('10000000-0000-0000-0000-00000000000a')$$), 'forbidden',
  'el owner de B no genera clases en A');

-- ---------------------------------------------------------------- grilla pública
select is(tests.count('anon', null,
  $$select * from public.list_public_sessions('estudio-a', now(), now() + interval '2 days')
    where session_id::text like '50000000-%'$$), 3,
  'un anónimo ve la grilla con las 3 clases que no empezaron (las de hoy y mañana)');
select is(tests.err('anon', null,
  $$select * from public.list_public_sessions('estudio-a', now(), now() + interval '90 days')$$), 'invalid_range',
  'no se puede pedir un rango enorme');

-- ---------------------------------------------------------------- gating
select is(public.studio_has_feature('10000000-0000-0000-0000-00000000000a', 'role_balance'), true,
  'el plan Inicial incluye balance de roles');
select is(public.studio_has_feature('10000000-0000-0000-0000-00000000000a', 'formations'), false,
  'el plan Inicial no incluye formaciones');

select * from finish();
rollback;
