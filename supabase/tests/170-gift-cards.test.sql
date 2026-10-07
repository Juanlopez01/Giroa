-- Gift cards: gating, compra online (pendiente hasta que paga), webhook
-- idempotente, venta en mostrador, canje una sola vez, otro estudio, vencida
-- y permisos.
begin;
select plan(20);
select tests.fixture();

insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');

select is(tests.err('anon', null,
  $$select public.create_gift_card_order('60000000-0000-0000-0000-0000000000a1', 'Juan Pérez', 'juan@test.com', 'Lía', '¡Feliz cumple!')$$),
  'feature_not_in_plan', 'en plan Inicial no se venden regalos');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.err('anon', null,
  $$select public.create_gift_card_order('60000000-0000-0000-0000-0000000000a1', 'Juan Pérez', 'Juan@Test.com', 'Lía', '¡Feliz cumple!')$$),
  'OK', 'cualquiera compra un regalo sin cuenta');
select is((select status::text || ' ' || amount_cents || ' ' || pack_name || ' ' || (code ~ '^REGALO-[A-Z2-9]{4}-[A-Z2-9]{4}$')
  from public.gift_cards where buyer_name = 'Juan Pérez'),
  'pending 3000000 8 clases true', 'queda pendiente, con el precio y el nombre del pack, y un código legible');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format('select public.redeem_gift_card(%L)', (select code from public.gift_cards where buyer_name = 'Juan Pérez'))),
  'gift_not_active', 'sin pagar no se puede canjear');

-- Webhook
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.mp_apply_gift_payment((select external_reference from public.gift_cards where buyer_name = 'Juan Pérez'), 'mp-9', 'approved', 3000000)$$),
  '42501', 'el webhook es solo del servidor');
select is(tests.err('service_role', null,
  $$select public.mp_apply_gift_payment((select external_reference from public.gift_cards where buyer_name = 'Juan Pérez'), 'mp-9', 'approved', 3000000)$$),
  'OK', 'MP aprueba el pago');
select tests.exec('service_role', null,
  $$select public.mp_apply_gift_payment((select external_reference from public.gift_cards where buyer_name = 'Juan Pérez'), 'mp-9', 'approved', 3000000)$$);
select ok((select status = 'active' and expires_at > now() + interval '11 months' from public.gift_cards where buyer_name = 'Juan Pérez'),
  'queda activa por 12 meses (y el reintento no cambia nada)');
select is((select count(*)::integer from public.notifications where template = 'gift_card' and to_address = 'juan@test.com'), 1,
  'se encola el mail con la tarjeta, una sola vez');

-- Tarjeta por link privado
select is(tests.q('anon', null,
  format('select public.get_gift_card(%L) as g', (select access_token from public.gift_cards where buyer_name = 'Juan Pérez'))) -> 0 -> 'g' ->> 'message',
  '¡Feliz cumple!', 'con el link se ve la tarjeta y el mensaje');

-- Canje
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b3',
  format('select public.redeem_gift_card(%L)', (select code from public.gift_cards where buyer_name = 'Juan Pérez'))),
  'gift_not_found', 'un alumno de otro estudio no lo puede canjear');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format('select public.redeem_gift_card(%L)', lower(replace((select code from public.gift_cards where buyer_name = 'Juan Pérez'), 'REGALO-', '')))),
  'OK', 'Ana lo canjea (aunque lo escriba en minúsculas y sin REGALO-)');
select is((select count(*)::integer from public.student_packs sp join public.gift_cards g on g.student_pack_id = sp.id
  where g.buyer_name = 'Juan Pérez' and sp.student_id = '30000000-0000-0000-0000-0000000000a1' and sp.credits_total = 8), 1,
  'se le acredita el pack');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  format('select public.redeem_gift_card(%L)', (select code from public.gift_cards where buyer_name = 'Juan Pérez'))),
  'gift_redeemed', 'no se puede canjear dos veces');

-- Mostrador: el profe sin permiso de cobro no vende; el owner sí.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.sell_gift_card_manual('60000000-0000-0000-0000-0000000000a1', 'Abuela', 'cash')$$),
  'cannot_take_payments', 'un profe sin permiso de cobro no vende regalos');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.sell_gift_card_manual('60000000-0000-0000-0000-0000000000a1', 'Abuela', 'cash', 'Nieta')$$),
  'OK', 'el owner vende uno en el mostrador');
select is((select status::text from public.gift_cards where buyer_name = 'Abuela'), 'active', 'queda activo al instante');

-- El staff canjea por un alumno; uno vencido no se canjea.
update public.gift_cards set expires_at = now() - interval '1 day' where buyer_name = 'Abuela';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  format('select public.redeem_gift_card(%L, %L)', (select code from public.gift_cards where buyer_name = 'Abuela'), '30000000-0000-0000-0000-0000000000a5')),
  'gift_expired', 'vencido no se canjea');
update public.gift_cards set expires_at = now() + interval '1 day' where buyer_name = 'Abuela';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  format('select public.redeem_gift_card(%L, %L)', (select code from public.gift_cards where buyer_name = 'Abuela'), '30000000-0000-0000-0000-0000000000a5')),
  'OK', 'el profe lo canjea por Eli');

-- RLS
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1', $$select access_token from public.gift_cards$$),
  '42501', 'el link privado no se puede leer desde la API');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b1', $$select id from public.gift_cards$$), 0,
  'el owner de B no ve los regalos de A');

select * from finish();
rollback;
