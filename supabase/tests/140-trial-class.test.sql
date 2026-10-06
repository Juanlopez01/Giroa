-- Clase de prueba: activación por el admin, una sola vez por persona, sin
-- saldo, se recupera si cancela a tiempo y no la usa quien ya compró.
begin;
select plan(15);
select tests.fixture();

-- Lía: usuaria nueva en A, sin packs.
insert into public.students (id, studio_id, user_id, full_name, email)
values ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-0000000000c1', 'Lía', 'lia@test.com');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, null, true)$$),
  'trial_not_available', 'sin activar no hay clase de prueba');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$update public.studios set trial_class_enabled = true where id = '10000000-0000-0000-0000-00000000000a'$$),
  0, 'el profe no la puede activar');
select is(tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$update public.studios set trial_class_enabled = true where id = '10000000-0000-0000-0000-00000000000a'$$),
  1, 'el owner la activa');

select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.my_trial_available('10000000-0000-0000-0000-00000000000a') as v$$) -> 0 ->> 'v', 'true',
  'Lía tiene su clase de prueba');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.my_trial_available('10000000-0000-0000-0000-00000000000a') as v$$) -> 0 ->> 'v', 'false',
  'Ana ya compró packs: no tiene clase de prueba');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$),
  'no_credits', 'sin la opción de prueba, pide saldo');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, null, true)$$),
  'OK', 'Lía reserva su clase de prueba');
select is((select is_trial and student_pack_id is null from public.bookings
  where student_id = '30000000-0000-0000-0000-0000000000c1' and status = 'booked'), true,
  'queda marcada como prueba, sin pack');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', 'leader', null, true)$$),
  'trial_not_available', 'no puede usar una segunda clase de prueba');

-- Cancela con anticipación: la recupera.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.cancel_booking((select id from public.bookings
    where student_id = '30000000-0000-0000-0000-0000000000c1' and status = 'booked'))$$);
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.my_trial_available('10000000-0000-0000-0000-00000000000a') as v$$) -> 0 ->> 'v', 'true',
  'si cancela a tiempo, la recupera');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, null, true)$$),
  'OK', 'la vuelve a reservar');
update public.bookings set status = 'no_show'
where student_id = '30000000-0000-0000-0000-0000000000c1' and status = 'booked';
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.my_trial_available('10000000-0000-0000-0000-00000000000a') as v$$) -> 0 ->> 'v', 'false',
  'si faltó, ya la usó');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2', null, null, true)$$),
  'trial_not_available', 'quien tiene packs no puede usar la prueba');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'la reserva normal sigue igual');
select is((select count(*)::integer from public.pack_credit_events e join public.bookings b on b.id = e.booking_id
  where b.is_trial), 0, 'la clase de prueba no mueve créditos');

select * from finish();
rollback;
