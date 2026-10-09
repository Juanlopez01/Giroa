-- Abonos mensuales: el alumno se abona, cada cobro aprobado carga el pack del
-- mes (lo del mes anterior se pierde), un cobro rechazado lo deja con deuda y
-- la baja la puede dar el alumno o el estudio.
begin;
select plan(20);
select tests.fixture();

update public.pack_products set is_membership = true where id = '60000000-0000-0000-0000-0000000000a1'; -- 8 clases
insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.start_membership('60000000-0000-0000-0000-0000000000a1')$$),
  'feature_unavailable', 'en el plan Inicial no hay abonos');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.start_membership('60000000-0000-0000-0000-0000000000a2')$$),
  'pack_not_found', 'un pack que no es abono no se puede abonar');

select set_config('t.sub', tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select (public.start_membership('60000000-0000-0000-0000-0000000000a1')).id as v$$) -> 0 ->> 'v', false);
select is((select status::text || '/' || amount_cents from public.student_subscriptions where id = current_setting('t.sub')::uuid),
  'pending/3000000', 'queda pendiente con el precio del pack');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select (public.start_membership('60000000-0000-0000-0000-0000000000a1')).id as v$$) -> 0 ->> 'v',
  current_setting('t.sub'), 'si vuelve a intentar, reusa el pendiente');

-- Quién lo ve.
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', $$select 1 from public.student_subscriptions$$), 1, 'Ana ve su abono');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4', $$select 1 from public.student_subscriptions$$), 0, 'Beto no lo ve');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a1', $$select 1 from public.student_subscriptions$$), 1, 'el dueño lo ve');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b1', $$select 1 from public.student_subscriptions$$), 0, 'otro estudio no lo ve');
select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format($$select public.mp_link_membership(%L, 'pre1')$$, current_setting('t.sub'))), 'OK', 'el alumno no vincula débitos');

-- Se vincula y MP lo autoriza.
select tests.q('service_role', null, format($$select public.mp_link_membership(%L, 'pre1') as v$$, current_setting('t.sub')));
select is(tests.q('service_role', null,
  format($$select public.mp_apply_membership(%L, 'pre1', 'authorized', now() + interval '1 month') ->> 'status' as v$$, current_setting('t.sub'))) -> 0 ->> 'v',
  'active', 'autorizado, queda activo');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.start_membership('60000000-0000-0000-0000-0000000000a1')$$), 'already_subscribed', 'no se abona dos veces');

-- Primer cobro: pago + pack del mes que vence después del próximo cobro.
select tests.q('service_role', null,
  $$select public.mp_apply_membership_charge('pre1', 'pay1', true, 3000000, now(), now() + interval '1 month') as v$$);
select is((select count(*)::integer from public.payments where subscription_id = current_setting('t.sub')::uuid and status = 'approved'), 1,
  'el cobro queda como pago');
select ok((select sp.expires_at > now() + interval '1 month' and sp.status = 'active' and sp.credits_total = 8 from public.student_packs sp
  join public.payments p on p.id = sp.payment_id where p.mp_payment_id = 'pay1'), 'y carga el pack del mes hasta después del próximo cobro');
select is(tests.q('service_role', null,
  $$select public.mp_apply_membership_charge('pre1', 'pay1', true, 3000000, now(), now() + interval '1 month') ->> 'duplicate' as v$$) -> 0 ->> 'v',
  'true', 'el mismo cobro dos veces no carga dos packs');

-- Cobro rechazado: queda con deuda.
select tests.q('service_role', null,
  $$select public.mp_apply_membership_charge('pre1', 'pay2', false, 3000000, null, null, 'Fondos insuficientes') as v$$);
select is((select status::text || '/' || last_error from public.student_subscriptions where id = current_setting('t.sub')::uuid),
  'past_due/Fondos insuficientes', 'un cobro rechazado lo deja con deuda');

-- Renovación: lo que quedó del mes anterior se pierde.
update public.student_packs set credits_used = 3
where payment_id = (select id from public.payments where mp_payment_id = 'pay1');
select tests.q('service_role', null,
  $$select public.mp_apply_membership_charge('pre1', 'pay3', true, 3000000, now(), now() + interval '2 months') as v$$);
select is((select sp.status::text from public.student_packs sp join public.payments p on p.id = sp.payment_id where p.mp_payment_id = 'pay1'),
  'expired', 'al renovar vence el pack del mes anterior');
select is((select delta from public.pack_credit_events e join public.student_packs sp on sp.id = e.student_pack_id
  join public.payments p on p.id = sp.payment_id where p.mp_payment_id = 'pay1' and e.kind = 'expire'), -5,
  'y se pierden las 5 clases que no usó');
select is((select status::text || '/' || coalesce(last_error, '-') from public.student_subscriptions where id = current_setting('t.sub')::uuid),
  'active/-', 'con el cobro aprobado vuelve a estar al día');

-- Baja: Beto no puede dar de baja el de Ana; Ana sí.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  format($$select public.cancel_membership(%L)$$, current_setting('t.sub'))), 'subscription_not_found', 'otro alumno no lo puede dar de baja');
select tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format($$select (public.cancel_membership(%L)).status as v$$, current_setting('t.sub')));
select is((select s.status::text || '/' || sp.status::text from public.student_subscriptions s
  join public.payments p on p.subscription_id = s.id join public.student_packs sp on sp.payment_id = p.id
  where s.id = current_setting('t.sub')::uuid and p.mp_payment_id = 'pay3'),
  'cancelled/active', 'dada de baja, el mes pagado sigue valiendo');

select * from finish();
rollback;
