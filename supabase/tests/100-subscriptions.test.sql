-- Suscripción autogestionada: estados de acceso, prueba, código de fundador y
-- eventos de Mercado Pago (solo servidor).
begin;
select plan(18);
select tests.fixture();

insert into public.studio_subscriptions (studio_id, status, trial_ends_at) values
  ('10000000-0000-0000-0000-00000000000a', 'trialing', now() + interval '10 days'),
  ('10000000-0000-0000-0000-00000000000b', 'trialing', now() - interval '3 days');

create function pg_temp.access_state(p_uid uuid, p_studio uuid) returns text language sql as $$
  select tests.q('authenticated', p_uid, format('select public.studio_access(%L) ->> %L as s', p_studio, 'state')) -> 0 ->> 's'
$$;

-- ---------------------------------------------------------------- estados
select is(pg_temp.access_state('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a'), 'trial',
  'en prueba');
select is(pg_temp.access_state('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b'), 'grace',
  'terminó la prueba hace 3 días: está en gracia');
update public.studio_subscriptions set trial_ends_at = now() - interval '8 days' where studio_id = '10000000-0000-0000-0000-00000000000b';
select is(pg_temp.access_state('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b'), 'blocked',
  'pasada la gracia, queda bloqueado');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.studio_access('10000000-0000-0000-0000-00000000000a')$$), 'forbidden',
  'un alumno no ve el estado de la suscripción');

-- ---------------------------------------------------------------- plan de prueba
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.choose_trial_plan('10000000-0000-0000-0000-00000000000a', 'pro')$$), 'OK',
  'durante la prueba el owner elige qué plan probar');
select is((select plan::text from public.studios where id = '10000000-0000-0000-0000-00000000000a'), 'pro',
  'el estudio pasa a probar Pro');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.choose_trial_plan('10000000-0000-0000-0000-00000000000a', 'estudio')$$), 'forbidden',
  'el profe no cambia el plan');

-- ---------------------------------------------------------------- precio y código
select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.giroa_quote('estudio', 'annual') ->> 'amount_cents' as a$$) -> 0 ->> 'a'), '59900000',
  'anual: se pagan 10 meses');
select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.giroa_quote('inicial', 'monthly', 'fundador') ->> 'amount_cents' as a$$) -> 0 ->> 'a'), '1495000',
  'con FUNDADOR paga la mitad');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.giroa_quote('inicial', 'monthly', 'TRUCHO')$$), 'invalid_coupon',
  'un código inválido se rechaza');

-- ---------------------------------------------------------------- eventos de MP (servidor)
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.giroa_apply_preapproval('10000000-0000-0000-0000-00000000000a', 'pre-1', 'authorized', 'estudio', 'monthly', 2995000, 50::smallint, 'FUNDADOR')$$),
  '42501', 'nadie salvo el servidor aplica suscripciones');

select tests.exec('service_role', null,
  $$select public.giroa_apply_preapproval('10000000-0000-0000-0000-00000000000b', 'pre-1', 'authorized', 'estudio', 'monthly', 2995000, 50::smallint, 'FUNDADOR', now() + interval '1 month')$$);
select is(pg_temp.access_state('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b'), 'active',
  'al autorizar la suscripción, el estudio bloqueado se reactiva');
select is((select plan::text from public.studios where id = '10000000-0000-0000-0000-00000000000b'), 'estudio',
  'y queda en el plan suscripto');
select is((select used_count from public.giroa_coupons where code = 'FUNDADOR'), 1, 'el código suma un uso');

select tests.exec('service_role', null,
  $$select public.giroa_apply_preapproval('10000000-0000-0000-0000-00000000000b', 'pre-1', 'authorized', 'estudio', 'monthly', 2995000, 50::smallint, 'FUNDADOR')$$);
select is((select used_count from public.giroa_coupons where code = 'FUNDADOR'), 1, 'un webhook repetido no cuenta el código dos veces');

select tests.exec('service_role', null, $$select public.giroa_apply_subscription_charge('pre-1', false)$$);
select is(pg_temp.access_state('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b'), 'grace',
  'si falla un cobro, entra en gracia');

select tests.exec('service_role', null, $$select public.giroa_apply_subscription_charge('pre-1', true, now() + interval '1 month')$$);
select is(pg_temp.access_state('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b'), 'active',
  'cuando se cobra, vuelve a activo');

-- Cambio de plan: una suscripción nueva reemplaza a la anterior.
select is((tests.q('service_role', null,
  $$select public.giroa_apply_preapproval('10000000-0000-0000-0000-00000000000b', 'pre-2', 'authorized', 'pro', 'monthly', 4995000, 50::smallint, 'FUNDADOR') ->> 'previous_preapproval_id' as p$$) -> 0 ->> 'p'),
  'pre-1', 'al cambiar de plan devuelve la suscripción vieja para cancelarla');

select * from finish();
rollback;
