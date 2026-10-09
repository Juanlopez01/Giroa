-- Pagos: manuales, grant_pack idempotente, checkout de MP, aplicación del
-- webhook y vencimiento de packs.
begin;
select plan(27);
select tests.fixture();
-- El profe del fixture puede cobrar (ver 150-team: sin el permiso no puede).
update public.studio_members set can_take_payments = true where id = '20000000-0000-0000-0000-0000000000a2';

-- ---------------------------------------------------------------- pago manual
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000a5', '60000000-0000-0000-0000-0000000000a1', 'cash')$$),
  'OK', 'el profe registra un pago en efectivo');
select is((select count(*)::integer from public.student_packs
  where student_id = '30000000-0000-0000-0000-0000000000a5' and payment_id is not null), 1,
  'se acredita el pack');
select is((select amount_cents from public.payments where student_id = '30000000-0000-0000-0000-0000000000a5'),
  3000000::bigint, 'sin monto, toma el precio del pack');
select is((select count(*)::integer from public.notifications
  where template = 'pack_granted' and student_id = '30000000-0000-0000-0000-0000000000a5' and status = 'pending'), 0,
  'Eli no tiene email: no se encola aviso pendiente');
select is((select status from public.notifications
  where template = 'pack_granted' and student_id = '30000000-0000-0000-0000-0000000000a5'), 'skipped',
  'queda registrado como omitido');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-0000000000b1', 'cash')$$),
  'student_not_found', 'el owner de A no registra pagos de alumnos de B');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000a5', '60000000-0000-0000-0000-0000000000b1', 'cash')$$),
  'pack_not_found', 'no se puede usar un pack de otro estudio');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000a5', '60000000-0000-0000-0000-0000000000a1', 'mercadopago')$$),
  'invalid_method', 'un pago manual no puede ser de MP');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a1', 'cash')$$),
  'student_not_found', 'una alumna no se puede cargar un pago');

-- ---------------------------------------------------------------- vencimiento: el día exacto
-- Comprado hoy con 30 días: vale hasta hoy + 30 inclusive (hora de Buenos Aires).
select is(
  (select expires_on from public.student_balances b
   join public.student_packs sp on sp.id = b.student_pack_id
   where sp.student_id = '30000000-0000-0000-0000-0000000000a5' and sp.payment_id is not null),
  (now() at time zone 'America/Argentina/Buenos_Aires')::date + 30,
  'vence el día de hoy + 30 (hora local del estudio)');

-- ---------------------------------------------------------------- checkout de MP
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1')$$),
  'mp_not_connected', 'sin MP vinculado no se puede comprar online');

select is(public.studio_accepts_online_payments('10000000-0000-0000-0000-00000000000a'), false,
  'sin MP vinculado el estudio no cobra online');
insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');
select is(tests.q('anon', null, $$select public.studio_accepts_online_payments('10000000-0000-0000-0000-00000000000a') as v$$) -> 0 ->> 'v', 'true',
  'con MP vinculado cobra online (y se puede consultar sin login)');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1')$$),
  'OK', 'Ana inicia la compra de un pack');
select is((select status::text || ' ' || amount_cents from public.payments
  where student_id = '30000000-0000-0000-0000-0000000000a1' and method = 'mercadopago'),
  'pending 3000000', 'queda un pago pendiente con el precio del producto');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1')$$),
  'not_a_student', 'un alumno de B no compra packs de A');

-- ---------------------------------------------------------------- webhook (service role)
create temp table ref as
select external_reference from public.payments
where student_id = '30000000-0000-0000-0000-0000000000a1' and method = 'mercadopago';
grant select on ref to authenticated, service_role;

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1', format(
  'select public.mp_apply_payment(%L, %L, %L, %s)', (select external_reference from ref), 'mp-1', 'approved', 3000000)),
  '42501', 'nadie salvo el servidor puede aplicar pagos de MP');

select is(tests.err('service_role', null, format(
  'select public.mp_apply_payment(%L, %L, %L, %s)', (select external_reference from ref), 'mp-1', 'approved', 100)),
  'OK', 'un aprobado con monto distinto no falla…');
select is((select count(*)::integer from public.student_packs sp join public.payments p on p.id = sp.payment_id
  where p.external_reference = (select external_reference from ref)), 0,
  '…pero no acredita el pack');

select is(tests.err('service_role', null, format(
  'select public.mp_apply_payment(%L, %L, %L, %s)', (select external_reference from ref), 'mp-1', 'approved', 3000000)),
  'OK', 'el webhook aprueba el pago');
select is(tests.err('service_role', null, format(
  'select public.mp_apply_payment(%L, %L, %L, %s)', (select external_reference from ref), 'mp-1', 'approved', 3000000)),
  'OK', 'el mismo webhook dos veces…');
select is((select count(*)::integer from public.student_packs sp join public.payments p on p.id = sp.payment_id
  where p.external_reference = (select external_reference from ref)), 1,
  '…acredita un solo pack (idempotente)');
select is(tests.err('service_role', null, format(
  'select public.mp_apply_payment(%L, %L, %L, %s)', (select external_reference from ref), 'mp-1', 'pending', 3000000)),
  'OK', 'un webhook viejo "pending" llega tarde…');
select is((select status::text from public.payments where external_reference = (select external_reference from ref)),
  'approved', '…y no pisa el aprobado');

-- ---------------------------------------------------------------- vencimiento (cron)
update public.student_packs set expires_at = now() - interval '1 minute', starts_at = now() - interval '31 days'
where id = '70000000-0000-0000-0000-0000000000a4';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select public.expire_packs()'),
  '42501', 'solo el cron vence packs');
-- (expire_packs recorre toda la base: se mira el pack de Dani, no el total.)
select tests.q('service_role', null, 'select public.expire_packs() as n');
select is((select status::text from public.student_packs where id = '70000000-0000-0000-0000-0000000000a4'), 'expired',
  'vence el pack de Dani');
select is((select delta from public.pack_credit_events
  where student_pack_id = '70000000-0000-0000-0000-0000000000a4' and kind = 'expire'), -8,
  'el historial registra las 8 clases que se perdieron');

select * from finish();
rollback;
