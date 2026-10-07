-- Cupones: gating, RLS, descuento % y fijo, a qué aplica, límites de uso,
-- una vez por persona, vencimiento y estado del uso según el pago.
begin;
select plan(22);
select tests.fixture();

insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.coupons (studio_id, code, kind, value) values ('10000000-0000-0000-0000-00000000000a', 'HOLA10', 'percent', 10)$$),
  '42501', 'en plan Inicial no se crean cupones');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$insert into public.coupons (studio_id, code, kind, value) values ('10000000-0000-0000-0000-00000000000a', 'HOLA10', 'percent', 10)$$),
  '42501', 'el profe no crea cupones');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.coupons (studio_id, code, kind, value, max_uses) values
    ('10000000-0000-0000-0000-00000000000a', 'HOLA10', 'percent', 10, 2),
    ('10000000-0000-0000-0000-00000000000a', 'MENOS5MIL', 'amount', 500000, null),
    ('10000000-0000-0000-0000-00000000000a', 'SOLOEVENTOS', 'percent', 50, null),
    ('10000000-0000-0000-0000-00000000000a', 'TODO', 'percent', 100, null)$$),
  'OK', 'el owner crea cupones');
update public.coupons set applies_to = 'events' where code = 'SOLOEVENTOS';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.coupons (studio_id, code, kind, value) values ('10000000-0000-0000-0000-00000000000a', 'MAL', 'percent', 150)$$),
  '23514', 'un porcentaje no puede pasar de 100');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', $$select id from public.coupons$$), 0,
  'los alumnos no ven la lista de códigos');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b1', $$select id from public.coupons$$), 0,
  'el owner de B no ve los de A');

-- Vista previa (pack de 8 clases a $30.000).
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.preview_coupon('10000000-0000-0000-0000-00000000000a', 'hola10', 'packs', 3000000) as p$$) -> 0 -> 'p' ->> 'final_cents',
  '2700000', 'HOLA10 (en minúsculas) baja el pack a $27.000');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.preview_coupon('10000000-0000-0000-0000-00000000000a', 'SOLOEVENTOS', 'packs', 3000000)$$),
  'coupon_wrong_target', 'un código de eventos no vale para packs');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.preview_coupon('10000000-0000-0000-0000-00000000000b', 'HOLA10', 'packs', 3000000)$$),
  'coupon_not_found', 'un código de A no vale en B');

-- Compra de pack con cupón.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1', 'HOLA10')$$),
  'OK', 'Ana compra el pack con HOLA10');
select is((select amount_cents || ' ' || discount_cents from public.payments
  where student_id = '30000000-0000-0000-0000-0000000000a1' and coupon_id is not null),
  '2700000 300000', 'el pago queda por el precio con descuento');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1', 'HOLA10')$$),
  'coupon_already_used', 'no lo puede usar dos veces');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1', 'TODO')$$),
  'coupon_covers_all', 'un 100% no se puede pagar online');

-- El pago se aprueba → uso confirmado.
select tests.exec('service_role', null,
  $$select public.mp_apply_payment((select external_reference from public.payments where coupon_id is not null
    and student_id = '30000000-0000-0000-0000-0000000000a1'), 'mp-1', 'approved', 2700000)$$);
select is((select r.status::text from public.coupon_redemptions r join public.payments p on p.id = r.payment_id
  where p.student_id = '30000000-0000-0000-0000-0000000000a1'), 'confirmed', 'al aprobarse, el uso queda confirmado');

-- Límite de usos (2): Beto lo usa y lo rechazan; el uso se libera.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1', 'HOLA10')$$);
select tests.exec('service_role', null,
  $$select public.mp_apply_payment((select external_reference from public.payments where coupon_id is not null
    and student_id = '30000000-0000-0000-0000-0000000000a2'), 'mp-2', 'rejected', 2700000)$$);
select is((select r.status::text from public.coupon_redemptions r join public.payments p on p.id = r.payment_id
  where p.student_id = '30000000-0000-0000-0000-0000000000a2'), 'void', 'si el pago se rechaza, el uso se anula');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1', 'HOLA10')$$),
  'OK', 'y Beto lo puede volver a intentar');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b3',
  $$select public.preview_coupon('10000000-0000-0000-0000-00000000000b', 'HOLA10', 'packs', 1500000)$$),
  'coupon_not_found', 'en otro estudio no existe');
-- Ya hay 2 usos vivos (Ana confirmado + Beto pendiente): tercero no.
insert into public.students (id, studio_id, user_id, full_name, email)
values ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Lía', 'lia@test.com');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1', 'HOLA10')$$),
  'coupon_exhausted', 'se respeta el límite de usos');

-- Monto fijo y vencimiento.
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.preview_coupon('10000000-0000-0000-0000-00000000000a', 'MENOS5MIL', 'packs', 3000000) as p$$) -> 0 -> 'p' ->> 'final_cents',
  '2500000', 'MENOS5MIL descuenta $5.000');
update public.coupons set valid_until = now() - interval '1 day' where code = 'MENOS5MIL';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.preview_coupon('10000000-0000-0000-0000-00000000000a', 'MENOS5MIL', 'packs', 3000000)$$),
  'coupon_expired', 'vencido no vale');

-- Entradas: 100% → la orden queda confirmada gratis.
insert into public.events (id, studio_id, title, starts_at, status) values
  ('e0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Milonga', now() + interval '7 days', 'published');
insert into public.event_ticket_types (id, studio_id, event_id, name, price_cents) values
  ('f0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a1', 'General', 500000);
select is(tests.err('anon', null,
  $$select public.create_event_order('f0000000-0000-0000-0000-0000000000a1', 2, 'Juan Pérez', 'juan@test.com', null, 'TODO')$$),
  'OK', 'una entrada con 100% de descuento');
select is((select status::text || ' ' || amount_cents || ' ' || discount_cents from public.event_orders where buyer_name = 'Juan Pérez'),
  'paid 0 1000000', 'queda confirmada sin pagar y con el descuento registrado');

select * from finish();
rollback;
