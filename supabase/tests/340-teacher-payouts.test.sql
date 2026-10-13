-- Liquidación de profes: reglas por clase (solo dueño/encargado, plan Pro), lo
-- que generó cada clase dictada, y pagos marcados (una vez por mes y profe).
-- Cada profe ve solo lo suyo.
begin;
select plan(17);
select tests.fixture();

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.set_payout_rules('40000000-0000-0000-0000-0000000000a1', '[]')$$), 'feature_unavailable', 'fuera del plan Pro no hay liquidación');

update public.studios set plan = 'pro' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.set_payout_rules('40000000-0000-0000-0000-0000000000a1', '[]')$$), 'offering_not_found', 'un profe no carga reglas');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.set_payout_rules('40000000-0000-0000-0000-0000000000a1', '[
    {"payee_name": "Profe A", "member_id": "20000000-0000-0000-0000-0000000000a2", "kind": "per_student", "amount_cents": 500000},
    {"payee_name": "Lucía Ferrari", "kind": "percent", "percent": 30}
  ]') as v$$) -> 0 ->> 'v', '2', 'el dueño carga dos profes en la clase');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.set_payout_rules('40000000-0000-0000-0000-0000000000a1', '[
    {"payee_name": "Uno", "kind": "percent", "percent": 70}, {"payee_name": "Dos", "kind": "percent", "percent": 40}]')$$),
  'invalid_rules', 'entre todos no pasan el 100%');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.set_payout_rules('40000000-0000-0000-0000-0000000000a1', '[{"payee_name": "Uno", "kind": "per_class", "amount_cents": -5}]')$$),
  'invalid_rules', 'montos negativos no');
select is((select count(*)::integer from public.payout_rules where offering_id = '40000000-0000-0000-0000-0000000000a1'), 2,
  'si falla, quedan las reglas que había');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.set_payout_rules('40000000-0000-0000-0000-0000000000a1', '[]')$$), 'offering_not_found', 'otro estudio no las toca');

-- Una clase de hace 2 días: Ana (pack de $30.000 / 8 = $3.750) y Dani (clase
-- suelta de $8.000) presentes; Beto ausente con un pack de regalo ($0); Carla
-- en clase de prueba ($0). Y una clase cancelada que no cuenta.
insert into public.sessions (id, studio_id, offering_id, starts_at, ends_at, status) values
  ('51000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000a1',
   now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', 'scheduled'),
  ('51000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-0000000000a1',
   now() - interval '3 days', now() - interval '3 days' + interval '90 minutes', 'cancelled');
insert into public.payments (id, studio_id, student_id, pack_product_id, amount_cents, method, status, paid_at)
values ('52000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a1',
  '60000000-0000-0000-0000-0000000000a1', 3000000, 'cash', 'approved', now() - interval '5 days');
update public.student_packs set payment_id = '52000000-0000-0000-0000-0000000000a1' where id = '70000000-0000-0000-0000-0000000000a1';
insert into public.bookings (id, studio_id, session_id, student_id, student_pack_id, status, checked_in_at, is_trial) values
  ('53000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '51000000-0000-0000-0000-0000000000a1',
   '30000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-0000000000a1', 'attended', now() - interval '2 days', false),
  ('53000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', '51000000-0000-0000-0000-0000000000a1',
   '30000000-0000-0000-0000-0000000000a2', '70000000-0000-0000-0000-0000000000a2', 'no_show', null, false),
  ('53000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', '51000000-0000-0000-0000-0000000000a1',
   '30000000-0000-0000-0000-0000000000a3', null, 'booked', null, true),
  ('53000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-00000000000a', '51000000-0000-0000-0000-0000000000a1',
   '30000000-0000-0000-0000-0000000000a4', null, 'attended', now() - interval '2 days', false);
insert into public.class_purchases (studio_id, session_id, student_id, booking_id, amount_cents, method, status, paid_at)
values ('10000000-0000-0000-0000-00000000000a', '51000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a4',
  '53000000-0000-0000-0000-0000000000a4', 800000, 'cash', 'paid', now() - interval '2 days');

select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select string_agg(present || '/' || used || '/' || revenue_cents, ',') as v
    from public.payout_sessions('10000000-0000-0000-0000-00000000000a', now() - interval '30 days', now() - interval '1 hour')$$) -> 0 ->> 'v',
  '2/4/1175000', 'la clase dictada: 2 presentes, 4 lugares y $11.750 (sin la cancelada)');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select 1 from public.payout_sessions('10000000-0000-0000-0000-00000000000a', now() - interval '30 days', now() - interval '1 hour')$$), 1,
  'el profe ve las clases donde tiene regla');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select * from public.payout_sessions('10000000-0000-0000-0000-00000000000a', now() - interval '30 days', now())$$), 'forbidden', 'un alumno no');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2', $$select 1 from public.payout_rules$$), 1,
  'el profe ve solo su regla');

-- Pagos.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.mark_payout_paid('10000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date, 'Lucía  Ferrari', null, 352500, '[]', 'transfer')$$),
  'OK', 'el dueño marca pagada a Lucía');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.mark_payout_paid('10000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date + 5, 'lucía ferrari', null, 1, '[]', 'cash')$$),
  'payout_already_paid', 'el mismo mes no se paga dos veces (aunque escriban distinto el nombre)');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.mark_payout_paid('10000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date, 'Profe A', '20000000-0000-0000-0000-0000000000a2', 1000000, '[]', 'cash')$$),
  'forbidden', 'el profe no se marca pagos');
select tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select (public.mark_payout_paid('10000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date, 'Profe A', '20000000-0000-0000-0000-0000000000a2', 1000000, '[]', 'cash')).id as v$$);
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2', $$select 1 from public.teacher_payouts$$), 1,
  'el profe ve solo su pago');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b1', $$select 1 from public.teacher_payouts$$), 0,
  'otro estudio no ve nada');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.undo_payout((select id from public.teacher_payouts where payee_name = 'Profe A')) as v$$) -> 0 ->> 'v', 'true',
  'el dueño lo deshace');

select * from finish();
rollback;
