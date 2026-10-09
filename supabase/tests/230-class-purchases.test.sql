-- Clases sueltas y workshops: reserva paga con lugar guardado 20 minutos,
-- pago por MP o mostrador, vencimiento, devoluciones y workshops sin pack.
begin;
select plan(21);
select tests.fixture();

update public.offerings set price_cents = 500000 where id = '40000000-0000-0000-0000-0000000000a2'; -- yoga
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a2')$$),
  'feature_unavailable', 'en el plan Inicial no hay clases sueltas');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a1', 'leader')$$),
  'not_for_sale', 'una clase sin precio suelto no se vende');

-- Ana reserva yoga suelta.
select set_config('t.ana', tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a2') ->> 'purchase_id' as v$$) -> 0 ->> 'v', false);
select is((select status from public.class_purchases where id = current_setting('t.ana')::uuid), 'pending', 'queda una compra pendiente');
select is((select b.status::text || '/' || coalesce(b.student_pack_id::text, 'sin pack') from public.bookings b
  join public.class_purchases p on p.booking_id = b.id where p.id = current_setting('t.ana')::uuid),
  'booked/sin pack', 'y el lugar reservado, sin tocar el pack');
select is((tests.q('anon', null, $$select spots_left from public.list_public_sessions('estudio-a', now(), now() + interval '2 days')
  where session_id = '50000000-0000-0000-0000-0000000000a2'$$) -> 0 ->> 'spots_left'), '1', 'el lugar cuenta en la grilla');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a2') ->> 'purchase_id' as v$$) -> 0 ->> 'v',
  current_setting('t.ana'), 'si reintenta, es la misma compra');
select is((select count(*)::integer from public.pack_credit_events where student_pack_id = '70000000-0000-0000-0000-0000000000a1'), 0,
  'no consume clases del pack');

-- Pago por MP.
select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format($$select public.mp_apply_class_payment(%L, 'mp1', 'approved', 500000)$$,
    (select external_reference from public.class_purchases where id = current_setting('t.ana')::uuid))),
  'OK', 'un alumno no puede confirmar pagos');
select is(tests.q('service_role', null,
  format($$select public.mp_apply_class_payment(%L, 'mp1', 'approved', 100) ->> 'ignored' as v$$,
    (select external_reference from public.class_purchases where id = current_setting('t.ana')::uuid))) -> 0 ->> 'v',
  'amount_mismatch', 'un monto distinto no lo da por pagado');
select tests.q('service_role', null,
  format($$select public.mp_apply_class_payment(%L, 'mp1', 'approved', 500000) as v$$,
    (select external_reference from public.class_purchases where id = current_setting('t.ana')::uuid)));
select is((select status || '/' || method::text from public.class_purchases where id = current_setting('t.ana')::uuid),
  'paid/mercadopago', 'con el monto correcto queda pagada');

-- Beto reserva, no paga a tiempo, vence; después llega el pago: recupera el lugar.
select set_config('t.beto', tests.q('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a2') ->> 'purchase_id' as v$$) -> 0 ->> 'v', false);
update public.class_purchases set hold_expires_at = now() - interval '1 minute' where id = current_setting('t.beto')::uuid;
select tests.q('service_role', null, $$select public.expire_class_purchases() as n$$);
select is((select p.status || '/' || b.status::text from public.class_purchases p join public.bookings b on b.id = p.booking_id
  where p.id = current_setting('t.beto')::uuid), 'expired/cancelled', 'vencida, se libera el lugar');
select tests.q('service_role', null,
  format($$select public.mp_apply_class_payment(%L, 'mp2', 'approved', 500000) as v$$,
    (select external_reference from public.class_purchases where id = current_setting('t.beto')::uuid)));
select is((select p.status || '/' || b.status::text from public.class_purchases p join public.bookings b on b.id = p.booking_id
  where p.id = current_setting('t.beto')::uuid), 'paid/booked', 'el pago tardío recupera el lugar si hay cupo');

-- Devolución por MP: se cancela la reserva.
select tests.q('service_role', null,
  format($$select public.mp_apply_class_payment(%L, 'mp2', 'refunded', 500000) as v$$,
    (select external_reference from public.class_purchases where id = current_setting('t.beto')::uuid)));
select is((select p.status || '/' || b.status::text from public.class_purchases p join public.bookings b on b.id = p.booking_id
  where p.id = current_setting('t.beto')::uuid), 'refunded/cancelled', 'la devolución cancela la reserva');

-- Mostrador: el profe sin permiso de cobro no vende; el dueño sí.
update public.offerings set price_cents = 400000 where id = '40000000-0000-0000-0000-0000000000a1'; -- tango
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.sell_class_manual('50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3', 'cash', 'leader')$$),
  'session_not_found', 'el profe sin permiso de cobro no vende clases sueltas');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.sell_class_manual('50000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3', 'cash', 'leader')$$),
  'OK', 'el dueño vende una clase suelta en el mostrador');

-- Beto reserva tango para pagar en el estudio; el dueño registra el pago.
select set_config('t.beto2', tests.q('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a1', 'follower') ->> 'purchase_id' as v$$) -> 0 ->> 'v', false);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  format($$select public.record_class_payment(%L, 'transfer')$$, current_setting('t.beto2'))),
  'OK', 'el dueño registra la transferencia');
select is((select status from public.class_purchases where id = current_setting('t.beto2')::uuid), 'paid', 'queda pagada');

-- Ana reserva tango para pagar y cancela antes: la compra se anula.
select set_config('t.ana2', tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a1', 'leader') ->> 'purchase_id' as v$$) -> 0 ->> 'v', false);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format($$select public.cancel_booking((select booking_id from public.class_purchases where id = %L))$$, current_setting('t.ana2')));
select is((select status from public.class_purchases where id = current_setting('t.ana2')::uuid), 'cancelled', 'si cancela antes de pagar, se anula');

-- Workshop que no vale con pack.
insert into public.offerings (id, studio_id, discipline_key, kind, title, capacity, price_cents, pack_allowed)
values ('40000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-00000000000a', 'yoga', 'special', 'Workshop de inversiones', 10, 1500000, false);
insert into public.sessions (id, studio_id, offering_id, starts_at, ends_at)
values ('50000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000a9',
        now() + interval '3 days', now() + interval '3 days 3 hours');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a9')$$), 'pay_required', 'el workshop sin pack pide pagarlo');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session_paid('50000000-0000-0000-0000-0000000000a9')$$), 'OK', 'y se reserva pagándolo');
select is((tests.q('anon', null, $$select price_cents from public.list_public_sessions('estudio-a', now(), now() + interval '5 days')
  where session_id = '50000000-0000-0000-0000-0000000000a9'$$) -> 0 ->> 'price_cents'), '1500000', 'la grilla muestra el workshop con su precio');

select * from finish();
rollback;
