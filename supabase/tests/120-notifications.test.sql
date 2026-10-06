-- Cola de avisos: tomar, terminar, reintentos y vencidos.
begin;
select plan(9);
select tests.fixture();

-- La cola es global: se vacía dentro de la transacción (se deshace al final).
delete from public.notifications;
insert into public.notifications (studio_id, template, to_address, payload, dedupe_key, created_at) values
  ('10000000-0000-0000-0000-00000000000a', 'event_tickets', 'uno@test.com', '{}', 't:1', now()),
  ('10000000-0000-0000-0000-00000000000a', 'event_tickets', 'dos@test.com', '{}', 't:2', now()),
  ('10000000-0000-0000-0000-00000000000a', 'event_tickets', 'viejo@test.com', '{}', 't:3', now() - interval '3 days');
insert into public.notifications (studio_id, template, to_address, payload, dedupe_key, send_after) values
  ('10000000-0000-0000-0000-00000000000a', 'event_tickets', 'futuro@test.com', '{}', 't:4', now() + interval '1 hour');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1', $$select * from public.claim_notifications()$$),
  '42501', 'el owner no puede tomar avisos');

select is(tests.count('service_role', null, $$select * from public.claim_notifications(10)$$), 2,
  'se toman los 2 avisos vigentes (ni el viejo ni el futuro)');
select is((select status from public.notifications where dedupe_key = 't:3'), 'skipped', 'el viejo se descarta');
select is(tests.count('service_role', null, $$select * from public.claim_notifications(10)$$), 0,
  'los tomados no se vuelven a tomar mientras dura el alquiler');

select is(tests.err('service_role', null,
  $$select public.finish_notification((select id from public.notifications where dedupe_key = 't:1'), true)$$),
  'OK', 'se marca enviado');
select is((select status from public.notifications where dedupe_key = 't:1'), 'sent', 'queda enviado');

select tests.exec('service_role', null,
  $$select public.finish_notification((select id from public.notifications where dedupe_key = 't:2'), false, 'Resend 500')$$);
select ok((select status = 'pending' and last_error = 'Resend 500' and send_after > now() from public.notifications where dedupe_key = 't:2'),
  'si falla vuelve a la cola, más tarde');

update public.notifications set attempts = 5 where dedupe_key = 't:2';
select tests.exec('service_role', null,
  $$select public.finish_notification((select id from public.notifications where dedupe_key = 't:2'), false, 'otra vez')$$);
select is((select status from public.notifications where dedupe_key = 't:2'), 'failed', 'al quinto intento queda fallido');

select lives_ok($$select private.kick_notification_worker()$$, 'sin secretos en Vault, el disparador no hace nada');

select * from finish();
rollback;
