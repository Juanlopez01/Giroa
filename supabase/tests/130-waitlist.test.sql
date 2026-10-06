-- Lista de espera: gating, anotarse con la clase llena o sin lugar para el rol,
-- aviso al liberarse un lugar, salida al reservar y aislamiento.
begin;
select plan(18);
select tests.fixture();

-- Yoga A (cupo 2) mañana: el profe anota a Carla y Dani → completa.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, '30000000-0000-0000-0000-0000000000a3')$$);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, '30000000-0000-0000-0000-0000000000a4')$$);

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.join_waitlist('50000000-0000-0000-0000-0000000000a2')$$),
  'feature_not_in_plan', 'en plan Inicial no hay lista de espera');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.join_waitlist('50000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'Ana se anota con la clase completa');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.join_waitlist('50000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'Beto también, después');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.join_waitlist('50000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'anotarse dos veces no falla');
select is((select count(*)::integer from public.session_waitlist
  where session_id = '50000000-0000-0000-0000-0000000000a2' and status = 'waiting'), 2, 'y no duplica');

select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select position from public.my_waitlist('10000000-0000-0000-0000-00000000000a')$$) -> 0 ->> 'position', '2',
  'Beto ve que es el segundo de la lista');

-- RLS
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select id from public.session_waitlist$$), 1, 'Ana ve solo su lugar en la lista');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select id from public.session_waitlist where studio_id = '10000000-0000-0000-0000-00000000000a'$$), 2, 'el profe ve toda la lista');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b3',
  $$select id from public.session_waitlist$$), 0, 'un alumno de B no ve nada');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$insert into public.session_waitlist (studio_id, session_id, student_id)
    values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1')$$),
  '42501', 'nadie escribe directo en la lista');

-- Se libera un lugar: el profe cancela la reserva de Carla.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.cancel_booking((select id from public.bookings
    where session_id = '50000000-0000-0000-0000-0000000000a2' and student_id = '30000000-0000-0000-0000-0000000000a3'))$$);
select is((select count(*)::integer from public.notifications
  where template = 'waitlist_spot' and payload ->> 'session_id' = '50000000-0000-0000-0000-0000000000a2'), 2,
  'se les avisa a los dos que esperan');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'Ana reserva el lugar');
select is((select status::text from public.session_waitlist
  where session_id = '50000000-0000-0000-0000-0000000000a2' and student_id = '30000000-0000-0000-0000-0000000000a1'),
  'booked', 'y sale sola de la lista');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.leave_waitlist('50000000-0000-0000-0000-0000000000a2')$$), 'OK', 'Beto se baja de la lista');
select is((select status::text from public.session_waitlist
  where session_id = '50000000-0000-0000-0000-0000000000a2' and student_id = '30000000-0000-0000-0000-0000000000a2'),
  'left', 'queda afuera');

-- Balance de roles en Tango A (balance 1): con Carla (líder) adentro, otro líder espera.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', null, '30000000-0000-0000-0000-0000000000a3')$$);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', 'follower', '30000000-0000-0000-0000-0000000000a4')$$);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', null, '30000000-0000-0000-0000-0000000000a5')$$);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.join_waitlist('50000000-0000-0000-0000-0000000000a1')$$),
  'OK', 'sin lugar como líder, Ana se anota aunque la clase no esté completa');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.join_waitlist('50000000-0000-0000-0000-0000000000a1', 'follower')$$),
  'has_spots', 'si hay lugar para su rol, le dice que reserve');

-- El estudio cancela la clase: no se avisa a la lista.
delete from public.notifications where template = 'waitlist_spot';
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.cancel_session('50000000-0000-0000-0000-0000000000a1', 'Lluvia')$$);
select is((select count(*)::integer from public.notifications where template = 'waitlist_spot'), 0,
  'si el estudio cancela la clase, no se avisa a la lista de espera');

select * from finish();
rollback;
