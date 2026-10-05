-- book_session: cupo, balance de roles, saldo, pack que vence primero y reglas.
begin;
select plan(27);
select tests.fixture();

-- Atajos: usuarios y sesiones.
--   a3 = Ana (líder)  a4 = Beto (seguidor)  b3 = Bruno (estudio B)
--   sesión a1 = tango mañana (cupo 4, balance 1)  a2 = yoga mañana (cupo 2)

-- ---------------------------------------------------------------- reserva ok
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1')$$), 'OK',
  'Ana reserva tango usando su rol por defecto');
select is((select dance_role::text from public.bookings
  where session_id = '50000000-0000-0000-0000-0000000000a1' and student_id = '30000000-0000-0000-0000-0000000000a1'),
  'leader', 'la reserva queda como líder');
select is((select credits_used from public.student_packs where id = '70000000-0000-0000-0000-0000000000a1'), 1,
  'se consume una clase del pack');
select is((select count(*)::integer from public.pack_credit_events
  where student_pack_id = '70000000-0000-0000-0000-0000000000a1' and kind = 'consume' and delta = -1), 1,
  'queda registrado en el historial de créditos');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1')$$), 'already_booked',
  'no puede reservar dos veces la misma clase');

-- ---------------------------------------------------------------- balance de roles
-- Hay 1 líder y 0 seguidores. Otro líder: (1+1) - 0 = 2 > 1 → no.
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', 'leader', '30000000-0000-0000-0000-0000000000a3')$$),
  'role_unbalanced', 'un segundo líder desbalancea la clase');
select is(tests.err_message('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', 'leader', '30000000-0000-0000-0000-0000000000a3')$$),
  'Por ahora no hay lugar como líder: faltan seguidores/as para mantener el balance de la clase. Probá más tarde.',
  'el error explica qué falta en palabras humanas');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1')$$), 'OK',
  'Beto entra como seguidor');
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', 'leader', '30000000-0000-0000-0000-0000000000a3')$$),
  'OK', 'con 1 y 1, ahora sí entra otro líder');
-- 2 líderes, 1 seguidor, cupo 4. Dani (seguidora) completa.
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', null, '30000000-0000-0000-0000-0000000000a4')$$),
  'OK', 'Dani entra como seguidora (rol por defecto)');

-- ---------------------------------------------------------------- cupo
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', 'follower', '30000000-0000-0000-0000-0000000000a5')$$),
  'session_full', 'con 4/4 la clase está completa');

-- ---------------------------------------------------------------- disciplina sin balance
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', 'follower')$$), 'OK',
  'en yoga reserva sin importar el rol');
select is((select dance_role from public.bookings
  where session_id = '50000000-0000-0000-0000-0000000000a2' and student_id = '30000000-0000-0000-0000-0000000000a1'),
  null::public.dance_role, 'en yoga la reserva no guarda rol');

-- ---------------------------------------------------------------- reglas de la clase
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a4')$$), 'session_started',
  'no se puede reservar una clase que ya empezó');

update public.sessions set status = 'cancelled' where id = '50000000-0000-0000-0000-0000000000a3';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3')$$), 'session_cancelled',
  'no se puede reservar una clase cancelada');
update public.sessions set status = 'scheduled' where id = '50000000-0000-0000-0000-0000000000a3';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'not_a_student',
  'un alumno de B no puede reservar en A');
select is(tests.err('anon', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), '42501',
  'anónimo no puede ejecutar book_session');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, '30000000-0000-0000-0000-0000000000a2')$$),
  'forbidden', 'una alumna no puede anotar a otra persona');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.book_session('50000000-0000-0000-0000-0000000000b1', 'leader', '30000000-0000-0000-0000-0000000000b1')$$),
  'forbidden', 'el owner de A no puede anotar gente en clases de B');

-- ---------------------------------------------------------------- saldo
update public.student_packs set credits_used = 8 where id = '70000000-0000-0000-0000-0000000000a5';
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, '30000000-0000-0000-0000-0000000000a5')$$),
  'no_credits', 'sin clases disponibles no reserva');

update public.student_packs set credits_used = 0, expires_at = now() + interval '1 hour'
where id = '70000000-0000-0000-0000-0000000000a5';
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, '30000000-0000-0000-0000-0000000000a5')$$),
  'no_credits', 'un pack que vence antes de la clase no sirve para esa clase');

-- Pack que vence primero: Beto tiene uno que vence en 30 días; le damos otro que vence en 10.
insert into public.student_packs (id, studio_id, student_id, name, credits_total, expires_at)
values ('70000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000a',
        '30000000-0000-0000-0000-0000000000a2', 'Promo', 2, now() + interval '10 days');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'OK',
  'Beto reserva yoga');
select is((select student_pack_id from public.bookings
  where session_id = '50000000-0000-0000-0000-0000000000a2' and student_id = '30000000-0000-0000-0000-0000000000a2'),
  '70000000-0000-0000-0000-0000000000f1'::uuid, 'consume primero el pack que vence antes');

-- Ilimitado.
insert into public.student_packs (id, studio_id, student_id, name, credits_total, expires_at)
values ('70000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-00000000000a',
        '30000000-0000-0000-0000-0000000000a5', 'Libre', null, now() + interval '30 days');
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3', 'leader', '30000000-0000-0000-0000-0000000000a5')$$),
  'OK', 'un pack ilimitado permite reservar');

-- Pack de pareja: el saldo es compartido.
update public.student_packs set credits_used = 8 where id = '70000000-0000-0000-0000-0000000000a3';
insert into public.student_packs (id, studio_id, student_id, partner_student_id, name, credits_total, expires_at)
values ('70000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-00000000000a',
        '30000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000a3', 'Pareja', 4, now() + interval '30 days');
select is(tests.err('service_role', null,
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3', 'follower', '30000000-0000-0000-0000-0000000000a3')$$),
  'OK', 'Carla reserva usando el pack de pareja de Dani');
select is((select credits_used from public.student_packs where id = '70000000-0000-0000-0000-0000000000f3'), 1,
  'el crédito sale del pack compartido');

-- ---------------------------------------------------------------- rol obligatorio
update public.students set default_role = null where id = '30000000-0000-0000-0000-0000000000a2';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3')$$), 'role_required',
  'en tango hay que elegir rol si no tiene uno por defecto');

select * from finish();
rollback;
