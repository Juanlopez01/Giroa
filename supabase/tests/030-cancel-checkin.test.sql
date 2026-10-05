-- cancel_booking (ventana de cancelación), check_in (con y sin reserva, QR),
-- cancel_session y mark_no_shows.
begin;
select plan(24);
select tests.fixture();

-- Reservas de partida:
--   Ana en tango mañana (a1)  → cancela con tiempo
--   Ana en tango en 2 horas (a3) → cancela dentro de la ventana de 3 h
--   Beto en tango en 2 horas (a3) → lo cancela el staff
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1')$$);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3')$$);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3')$$);

create temp table b as
select session_id, student_id, id from public.bookings;
grant select on b to authenticated, service_role;

-- ---------------------------------------------------------------- cancelación del alumno
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3', format(
  'select public.cancel_booking(%L)',
  (select id from b where session_id = '50000000-0000-0000-0000-0000000000a1' and student_id = '30000000-0000-0000-0000-0000000000a1'))),
  'OK', 'Ana cancela la clase de mañana');
select is((select credit_refunded from public.bookings
  where session_id = '50000000-0000-0000-0000-0000000000a1' and student_id = '30000000-0000-0000-0000-0000000000a1'),
  true, 'con más de 3 h de anticipación se devuelve la clase');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3', format(
  'select public.cancel_booking(%L)',
  (select id from b where session_id = '50000000-0000-0000-0000-0000000000a3' and student_id = '30000000-0000-0000-0000-0000000000a1'))),
  'OK', 'Ana cancela la clase de dentro de 2 horas');
select is((select credit_refunded from public.bookings
  where session_id = '50000000-0000-0000-0000-0000000000a3' and student_id = '30000000-0000-0000-0000-0000000000a1'),
  false, 'dentro de la ventana no se devuelve la clase');
select is((select credits_used from public.student_packs where id = '70000000-0000-0000-0000-0000000000a1'), 1,
  'Ana usó 2, le devolvieron 1: queda 1 usada');
select is((select count(*)::integer from public.pack_credit_events
  where student_pack_id = '70000000-0000-0000-0000-0000000000a1' and kind = 'refund'), 1,
  'la devolución queda en el historial');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3', format(
  'select public.cancel_booking(%L)',
  (select id from b where session_id = '50000000-0000-0000-0000-0000000000a1' and student_id = '30000000-0000-0000-0000-0000000000a1'))),
  'booking_not_active', 'no se puede cancelar dos veces');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3', format(
  'select public.cancel_booking(%L)',
  (select id from b where session_id = '50000000-0000-0000-0000-0000000000a3' and student_id = '30000000-0000-0000-0000-0000000000a2'))),
  'booking_not_found', 'Ana no puede cancelar la reserva de Beto');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1', format(
  'select public.cancel_booking(%L)',
  (select id from b where session_id = '50000000-0000-0000-0000-0000000000a3' and student_id = '30000000-0000-0000-0000-0000000000a2'))),
  'booking_not_found', 'el owner de B no puede cancelar reservas de A');

-- ---------------------------------------------------------------- cancelación del staff
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2', format(
  'select public.cancel_booking(%L)',
  (select id from b where session_id = '50000000-0000-0000-0000-0000000000a3' and student_id = '30000000-0000-0000-0000-0000000000a2'))),
  'OK', 'el profe cancela la reserva de Beto dentro de la ventana');
select is((select credit_refunded from public.bookings
  where session_id = '50000000-0000-0000-0000-0000000000a3' and student_id = '30000000-0000-0000-0000-0000000000a2'),
  true, 'el staff devuelve la clase por defecto');

-- ---------------------------------------------------------------- check-in
-- Beto reserva la clase que empezó hace 10 minutos (como staff, porque el alumno ya no puede).
insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role)
values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000a4',
        '30000000-0000-0000-0000-0000000000a2', '70000000-0000-0000-0000-0000000000a2', 'follower');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in('50000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'el profe marca presente a Beto');
select is((select status::text from public.bookings
  where session_id = '50000000-0000-0000-0000-0000000000a4' and student_id = '30000000-0000-0000-0000-0000000000a2'),
  'attended', 'Beto queda presente');
select is((select credits_used from public.student_packs where id = '70000000-0000-0000-0000-0000000000a2'), 0,
  'el check-in con reserva no consume otra clase');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in('50000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'escanear dos veces no rompe nada');

-- Sin reserva, por QR.
select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a2', format(
  'select public.check_in_by_qr(%L, %L) as r', '50000000-0000-0000-0000-0000000000a4',
  (select qr_token from public.students where id = '30000000-0000-0000-0000-0000000000a3'))) -> 0 -> 'r' ->> 'walk_in'),
  'true', 'Carla llega sin reserva y entra por QR');
select is((select credits_used from public.student_packs where id = '70000000-0000-0000-0000-0000000000a3'), 1,
  'sin reserva consume una clase');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in_by_qr('50000000-0000-0000-0000-0000000000a4', 'qr-inventado')$$),
  'qr_not_found', 'un QR que no es del estudio se rechaza');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2', format(
  'select public.check_in_by_qr(%L, %L)', '50000000-0000-0000-0000-0000000000a4',
  (select qr_token from public.students where id = '30000000-0000-0000-0000-0000000000b1'))),
  'qr_not_found', 'el QR de un alumno de otro estudio se rechaza');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.check_in('50000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000a1')$$),
  'forbidden', 'una alumna no puede marcarse presente');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in('50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1')$$),
  'too_early', 'no se toma asistencia de una clase de mañana');

-- ---------------------------------------------------------------- cancelar una clase entera
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1')$$);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.cancel_session('50000000-0000-0000-0000-0000000000a1', 'Lluvia')$$),
  'forbidden', 'el profe no cancela clases (solo owner/admin)');
select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.cancel_session('50000000-0000-0000-0000-0000000000a1', 'Corte de luz') as n$$) -> 0 ->> 'n'),
  '1', 'el owner cancela la clase: se cancela 1 reserva activa');
select is((select count(*)::integer from public.notifications
  where template = 'session_cancelled' and student_id = '30000000-0000-0000-0000-0000000000a2'), 1,
  'se encola el aviso a Beto');

select * from finish();
rollback;
