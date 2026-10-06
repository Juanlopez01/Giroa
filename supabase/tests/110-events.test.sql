-- Eventos con entradas: gating por plan, RLS, cupo sin sobreventa, compra
-- gratis y por MP (webhook idempotente), "tus entradas", control en la puerta,
-- venta manual y cancelación.
begin;
select plan(45);
select tests.fixture();

-- Estudio A pasa a plan Estudio (tiene event_tickets) y vincula MP. B queda en Inicial.
update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';
insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');

-- ---------------------------------------------------------------- gating y permisos de alta
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$insert into public.events (studio_id, title, starts_at)
    values ('10000000-0000-0000-0000-00000000000b', 'Milonga', now() + interval '7 days')$$),
  '42501', 'en plan Inicial no se pueden crear eventos');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.events (studio_id, title, starts_at)
    values ('10000000-0000-0000-0000-00000000000a', 'Milonga de prueba', now() + interval '7 days')$$),
  'OK', 'el owner de A (plan Estudio) crea un evento');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$insert into public.events (studio_id, title, starts_at)
    values ('10000000-0000-0000-0000-00000000000a', 'Otra', now() + interval '7 days')$$),
  '42501', 'el profe no crea eventos');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.events (studio_id, title, starts_at)
    values ('10000000-0000-0000-0000-00000000000b', 'Ajena', now() + interval '7 days')$$),
  '42501', 'el owner de A no crea eventos en B');

-- Datos fijos (como postgres).
insert into public.events (id, studio_id, title, starts_at, status) values
  ('e0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Milonga del sábado', now() + interval '7 days', 'published'),
  ('e0000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'Borrador', now() + interval '14 days', 'draft'),
  ('e0000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'Milonga de B', now() + interval '7 days', 'published');
insert into public.event_ticket_types (id, studio_id, event_id, name, price_cents, quantity, max_per_order) values
  ('f0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', 'Anticipada', 500000, 3, 2),
  ('f0000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', 'Invitación', 0, null, 10),
  ('f0000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a2', 'General', 100000, null, 10),
  ('f0000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-0000000000b1', 'General', 0, null, 10);

-- ---------------------------------------------------------------- RLS de lectura
select is(tests.count('anon', null,
  $$select id from public.events where studio_id = '10000000-0000-0000-0000-00000000000a'$$),
  1, 'el público ve solo los eventos publicados');
select is(tests.count('anon', null,
  $$select id from public.event_ticket_types where studio_id = '10000000-0000-0000-0000-00000000000a'$$),
  2, 'el público no ve las entradas de un borrador');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select id from public.events where studio_id = '10000000-0000-0000-0000-00000000000a'$$),
  3, 'el staff ve también los borradores');
select is(tests.err('anon', null, $$select * from public.event_orders$$),
  '42501', 'el público no lee órdenes');

-- ---------------------------------------------------------------- compra online y cupo
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a1', 3, 'Juan Pérez', 'juan@test.com')$$),
  'invalid_quantity', 'no se pasa del máximo por compra');
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a1', 1, 'Juan Pérez', 'juan@')$$),
  'invalid_email', 'pide un email válido');
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a3', 1, 'Juan Pérez', 'juan@test.com')$$),
  'not_on_sale', 'un borrador no vende entradas');
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000b1', 1, 'Juan Pérez', 'juan@test.com')$$),
  'feature_not_in_plan', 'un estudio sin la feature no vende entradas');

select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a1', 2, 'Juan Pérez', 'Juan@Test.com', '11 5555-5555')$$),
  'OK', 'el público compra 2 anticipadas sin cuenta');
select is((select status::text || ' ' || amount_cents || ' ' || buyer_email || ' ' || (hold_expires_at > now())
  from public.event_orders where buyer_name = 'Juan Pérez'),
  'pending 1000000 juan@test.com true', 'queda pendiente, con el precio del tipo y la reserva activa');
select is((select remaining from public.event_availability('e0000000-0000-0000-0000-0000000000a1')
  where ticket_type_id = 'f0000000-0000-0000-0000-0000000000a1'), 1, 'queda 1 anticipada');
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a1', 2, 'Otra Persona', 'otra@test.com')$$),
  'not_enough_tickets', 'no se sobrevende');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a1', 1, 'Ana', 'ana@test.com')$$),
  'OK', 'Ana compra la última');
select is((select student_id from public.event_orders where buyer_name = 'Ana'),
  '30000000-0000-0000-0000-0000000000a1'::uuid, 'si quien compra es alumna, la orden queda vinculada');
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a1', 1, 'Otra Persona', 'otra@test.com')$$),
  'sold_out', 'agotadas');

-- Vence la reserva de Juan: se liberan sus 2 lugares.
update public.event_orders set hold_expires_at = now() - interval '1 minute' where buyer_name = 'Juan Pérez';
select is((select remaining from public.event_availability('e0000000-0000-0000-0000-0000000000a1')
  where ticket_type_id = 'f0000000-0000-0000-0000-0000000000a1'), 2, 'una reserva vencida libera el cupo');

-- ---------------------------------------------------------------- entrada gratis
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a2', 3, 'Invitada', 'invitada@test.com')$$),
  'OK', 'se piden 3 invitaciones gratis');
select is((select status::text from public.event_orders where buyer_name = 'Invitada'), 'paid',
  'gratis: queda confirmada al instante');
select is((select count(*)::integer from public.event_tickets t join public.event_orders o on o.id = t.order_id
  where o.buyer_name = 'Invitada'), 3, 'se emite una entrada por persona');
select is((select count(*)::integer from public.notifications n join public.event_orders o on o.id = (n.payload ->> 'order_id')::uuid
  where o.buyer_name = 'Invitada' and n.template = 'event_tickets' and n.to_address = 'invitada@test.com'), 1,
  'se encola el mail con las entradas');

-- ---------------------------------------------------------------- webhook de MP
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.mp_apply_event_payment((select external_reference from public.event_orders where buyer_name = 'Ana'), '900', 'approved', 500000)$$),
  '42501', 'el webhook es solo del servidor');
select is(tests.err('service_role', null,
  $$select public.mp_apply_event_payment((select external_reference from public.event_orders where buyer_name = 'Ana'), '900', 'approved', 500000)$$),
  'OK', 'el webhook aprueba la compra de Ana');
select is(tests.err('service_role', null,
  $$select public.mp_apply_event_payment((select external_reference from public.event_orders where buyer_name = 'Ana'), '900', 'approved', 500000)$$),
  'OK', 'un reintento del webhook no falla');
select is((select count(*)::integer from public.event_tickets t join public.event_orders o on o.id = t.order_id
  where o.buyer_name = 'Ana'), 1, 'y no duplica entradas');
select is(tests.err('service_role', null,
  $$select public.mp_apply_event_payment((select external_reference from public.event_orders where buyer_name = 'Juan Pérez'), '901', 'approved', 1000000)$$),
  'OK', 'el pago de Juan llega tarde');
select ok((select status = 'paid' and notes like '%vencida la reserva%' from public.event_orders where buyer_name = 'Juan Pérez'),
  'se acepta igual, con una nota para revisar el cupo');

-- ---------------------------------------------------------------- tus entradas
select is(jsonb_array_length(tests.q('anon', null,
  format('select public.get_event_order(%L) as o', (select access_token from public.event_orders where buyer_name = 'Juan Pérez')))
  -> 0 -> 'o' -> 'tickets'), 2, 'con el link privado se ven las 2 entradas');
select is(tests.q('anon', null, $$select public.get_event_order('no-existe') as o$$) -> 0 -> 'o', 'null'::jsonb,
  'con un link inventado no se ve nada');

-- ---------------------------------------------------------------- control en la puerta
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in_ticket('e0000000-0000-0000-0000-0000000000a1',
    (select t.qr_token from public.event_tickets t join public.event_orders o on o.id = t.order_id where o.buyer_name = 'Ana')) as r$$)
  -> 0 -> 'r' ->> 'already_checked_in', 'false', 'el profe valida la entrada de Ana');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in_ticket('e0000000-0000-0000-0000-0000000000a1',
    (select t.qr_token from public.event_tickets t join public.event_orders o on o.id = t.order_id where o.buyer_name = 'Ana')) as r$$)
  -> 0 -> 'r' ->> 'already_checked_in', 'true', 'si la escanea de nuevo avisa que ya ingresó');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.check_in_ticket('e0000000-0000-0000-0000-0000000000a1', 'x')$$),
  'forbidden', 'el owner de B no controla entradas de A');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in_ticket('e0000000-0000-0000-0000-0000000000a2',
    (select t.qr_token from public.event_tickets t join public.event_orders o on o.id = t.order_id where o.buyer_name = 'Ana'))$$),
  'wrong_event', 'una entrada de otro evento no pasa');

-- ---------------------------------------------------------------- venta en la puerta
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.sell_event_tickets_manual('f0000000-0000-0000-0000-0000000000a2', 2, 'En puerta', 'cash')$$),
  'OK', 'el profe vende 2 en la puerta');
select is((select count(*)::integer from public.event_tickets t join public.event_orders o on o.id = t.order_id
  where o.buyer_name = 'En puerta'), 2, 'se emiten las entradas');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.sell_event_tickets_manual('f0000000-0000-0000-0000-0000000000a2', 1, 'Yo', 'cash')$$),
  'forbidden', 'una alumna no vende entradas');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.sell_event_tickets_manual('f0000000-0000-0000-0000-0000000000a1', 1, 'Yo', 'cash')$$),
  'not_enough_tickets', 'la venta manual también respeta el cupo');

-- ---------------------------------------------------------------- cancelación y reintegro
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.cancel_event_order((select id from public.event_orders where buyer_name = 'En puerta'))$$),
  'forbidden', 'el profe no cancela compras');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.cancel_event_order((select id from public.event_orders where buyer_name = 'En puerta'), 'Se equivocó')$$),
  'OK', 'el owner cancela una compra');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.check_in_ticket('e0000000-0000-0000-0000-0000000000a1',
    (select t.qr_token from public.event_tickets t join public.event_orders o on o.id = t.order_id where o.buyer_name = 'En puerta' limit 1))$$),
  'ticket_cancelled', 'una entrada cancelada no pasa');
select is(tests.err('service_role', null,
  $$select public.mp_apply_event_payment((select external_reference from public.event_orders where buyer_name = 'Juan Pérez'), '901', 'refunded', 1000000)$$),
  'OK', 'MP avisa un reintegro');
select is((select count(*)::integer from public.event_tickets t join public.event_orders o on o.id = t.order_id
  where o.buyer_name = 'Juan Pérez' and t.status = 'cancelled'), 2, 'el reintegro cancela las entradas');

select * from finish();
rollback;
