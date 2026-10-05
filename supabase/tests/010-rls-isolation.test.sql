-- Aislamiento RLS: un estudio no ve datos de otro, un alumno solo ve lo suyo,
-- un anónimo solo ve la info pública y nadie toca mp_connections.
begin;
select plan(36);
select tests.fixture();

-- Datos para tener filas sensibles en ambos estudios.
insert into public.payments (studio_id, student_id, pack_product_id, amount_cents, method, status, paid_at)
values
  ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a1', 3000000, 'cash', 'approved', now()),
  ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a2', '60000000-0000-0000-0000-0000000000a1', 3000000, 'cash', 'approved', now()),
  ('10000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-0000000000b1', 1500000, 'cash', 'approved', now());

insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role) values
  ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-0000000000a1', 'leader'),
  ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2', '70000000-0000-0000-0000-0000000000a2', 'follower'),
  ('10000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000b1', '70000000-0000-0000-0000-0000000000b1', 'leader');

insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');

-- ---------------------------------------------------------------- staff de A
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.students'), 5,
  'owner A ve sus 5 alumnos y ninguno de B');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.payments'), 2,
  'owner A ve solo los pagos de A');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.bookings'), 2,
  'owner A ve solo las reservas de A');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.student_packs'), 5,
  'owner A ve solo los packs de A');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select * from public.studio_members where studio_id = '10000000-0000-0000-0000-00000000000b'$$), 0,
  'owner A no ve el staff de B');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.studio_subscriptions'), 0,
  'owner A no ve suscripciones (no se crearon por fixture) ni las de B');

select is(tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$update public.students set full_name = 'hackeado' where studio_id = '10000000-0000-0000-0000-00000000000b'$$), 0,
  'owner A no puede editar alumnos de B');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.students (studio_id, full_name) values ('10000000-0000-0000-0000-00000000000b', 'Intruso')$$), '42501',
  'owner A no puede crear alumnos en B');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.offerings (studio_id, discipline_key, title, capacity) values ('10000000-0000-0000-0000-00000000000b', 'tango', 'Intrusa', 5)$$), '42501',
  'owner A no puede crear clases en B');
select is(tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$update public.studios set name = 'Hackeado' where id = '10000000-0000-0000-0000-00000000000b'$$), 0,
  'owner A no puede editar el estudio B');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$update public.studios set plan = 'pro' where id = '10000000-0000-0000-0000-00000000000a'$$), '42501',
  'owner A no puede cambiarse el plan');
select is(tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$update public.studios set brand_color = '#112233' where id = '10000000-0000-0000-0000-00000000000a'$$), 1,
  'owner A sí puede cambiar el color de su estudio');

-- ---------------------------------------------------------------- profe de A
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2', 'select * from public.students'), 5,
  'el profe ve los alumnos de su estudio');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2', 'select * from public.payments'), 0,
  'el profe no ve los pagos (ingresos)');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2', 'select * from public.student_packs'), 5,
  'el profe ve los saldos (para el check-in)');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$insert into public.offerings (studio_id, discipline_key, title, capacity) values ('10000000-0000-0000-0000-00000000000a', 'tango', 'Nueva', 5)$$), '42501',
  'el profe no crea clases (solo owner/admin)');

-- ---------------------------------------------------------------- alumna de A
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', 'select * from public.students'), 1,
  'la alumna ve solo su ficha');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', 'select * from public.payments'), 1,
  'la alumna ve solo sus pagos');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', 'select * from public.bookings'), 1,
  'la alumna ve solo sus reservas');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', 'select * from public.student_balances'), 1,
  'la alumna ve solo su saldo');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', 'select * from public.studio_members'), 0,
  'la alumna no ve el staff');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$insert into public.bookings (studio_id, session_id, student_id) values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a1')$$), '42501',
  'la alumna no puede insertar reservas directo');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$update public.student_packs set credits_used = 0$$), '42501',
  'la alumna no puede tocar su saldo directo');
select is(tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$update public.students set full_name = 'Otra' where id = '30000000-0000-0000-0000-0000000000a1'$$), 0,
  'la alumna no edita su ficha directo (va por RPC)');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$update public.students set user_id = '00000000-0000-0000-0000-0000000000a3'$$), '42501',
  'nadie puede reasignar user_id directo');

-- ---------------------------------------------------------------- otro estudio / sin estudio
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b3',
  $$select * from public.bookings where studio_id = '10000000-0000-0000-0000-00000000000a'$$), 0,
  'el alumno de B no ve reservas de A');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select * from public.students'), 0,
  'un usuario sin estudio no ve alumnos');

-- ---------------------------------------------------------------- anónimo
select is(tests.count('anon', null, 'select * from public.studios'), 2,
  'anónimo ve los estudios activos');
select is(tests.count('anon', null, $$select * from public.offerings where studio_id = '10000000-0000-0000-0000-00000000000a'$$), 2,
  'anónimo ve las clases activas');
select is(tests.count('anon', null, 'select * from public.pack_products'), 3,
  'anónimo ve los packs activos');
select is(tests.err('anon', null, 'select * from public.students'), '42501',
  'anónimo no puede leer alumnos');
select is(tests.err('anon', null, 'select * from public.bookings'), '42501',
  'anónimo no puede leer reservas');
select is(tests.err('anon', null, 'select * from public.payments'), '42501',
  'anónimo no puede leer pagos');

-- ---------------------------------------------------------------- mp_connections
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.mp_connections'), '42501',
  'ni el owner puede leer mp_connections');
select is(tests.err('anon', null, 'select * from public.mp_connections'), '42501',
  'anónimo no puede leer mp_connections');
select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select * from public.mp_connection_status('10000000-0000-0000-0000-00000000000a')$$) -> 0 ->> 'connected'), 'true',
  'el owner ve si MP está vinculado, sin tokens');

select * from finish();
rollback;
