-- Recomendaciones entre estudios: alta con el link, premio al primer cobro
-- (10% por estudio, hasta 25%), precio con el descuento y permisos.
begin;
select plan(27);
select tests.fixture();

-- A y B ya están suscriptos (Inicial mensual, con 50% de fundador). C y D son
-- estudios nuevos de usuarios sin estudio.
insert into public.studio_subscriptions (studio_id, status, plan, billing_cycle, amount_cents, discount_pct, founder_discount_pct, mp_preapproval_id) values
  ('10000000-0000-0000-0000-00000000000a', 'active', 'inicial', 'monthly', 1495000, 50, 50, 'pre-a'),
  ('10000000-0000-0000-0000-00000000000b', 'active', 'inicial', 'monthly', 2990000, 0, 0, 'pre-b');
select tests.create_user('00000000-0000-0000-0000-0000000000d1', 'owner-d@test.com');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'owner-e@test.com');
select tests.create_user('00000000-0000-0000-0000-0000000000f1', 'owner-f@test.com');

create function pg_temp.new_studio(p_uid uuid, p_slug text) returns uuid language sql as $$
  select (tests.q('authenticated', p_uid, format('select (public.create_studio(%L, %L)).id as id', 'Estudio ' || p_slug, p_slug)) -> 0 ->> 'id')::uuid
$$;
create function pg_temp.claim(p_uid uuid, p_studio uuid, p_slug text) returns text language sql as $$
  select tests.q('authenticated', p_uid, format('select public.claim_studio_referral(%L, %L)::text as r', p_studio, p_slug)) -> 0 ->> 'r'
$$;
create function pg_temp.quote(p_uid uuid, p_sql text) returns jsonb language sql as $$
  select tests.q('authenticated', p_uid, 'select ' || p_sql || ' as j') -> 0 -> 'j'
$$;

select pg_temp.new_studio('00000000-0000-0000-0000-0000000000c1', 'estudio-c');
select pg_temp.new_studio('00000000-0000-0000-0000-0000000000d1', 'estudio-d');
select pg_temp.new_studio('00000000-0000-0000-0000-0000000000e1', 'estudio-e');
select pg_temp.new_studio('00000000-0000-0000-0000-0000000000f1', 'estudio-f');
create temp table ids as select id, slug from public.studios where slug in ('estudio-c', 'estudio-d', 'estudio-e', 'estudio-f');
grant select on ids to authenticated, service_role;
create function pg_temp.sid(p_slug text) returns uuid language sql as $$ select id from ids where slug = p_slug $$;

-- ---------------------------------------------------------------- alta con el link
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000c1', pg_temp.sid('estudio-c'), ' Estudio-A '), 'true',
  'el estudio nuevo anota que lo recomendó A');
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000c1', pg_temp.sid('estudio-c'), 'estudio-b'), 'false',
  'una sola recomendación por estudio');
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000d1', pg_temp.sid('estudio-d'), 'no-existe'), 'false',
  'un link de un estudio que no existe no frena el alta');
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000d1', pg_temp.sid('estudio-d'), 'estudio-d'), 'false',
  'no se puede recomendar a sí mismo');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  format('select public.claim_studio_referral(%L, %L)', pg_temp.sid('estudio-d'), 'estudio-a')), 'forbidden',
  'solo el owner del estudio nuevo lo anota');
select is(tests.err('anon', null,
  format('select public.claim_studio_referral(%L, %L)', pg_temp.sid('estudio-d'), 'estudio-a')), '42501',
  'anon no puede');

-- El owner de A abre otro estudio y se "recomienda" desde A: no cuenta.
select pg_temp.new_studio('00000000-0000-0000-0000-0000000000a1', 'estudio-a-dos');
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000a1', (select id from public.studios where slug = 'estudio-a-dos'), 'estudio-a'), 'false',
  'recomendarse desde un estudio propio no cuenta');

-- Un estudio con más de 7 días ya no puede anotarse.
update public.studios set created_at = now() - interval '8 days' where slug = 'estudio-f';
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000f1', pg_temp.sid('estudio-f'), 'estudio-a'), 'false',
  'solo estudios nuevos (7 días)');
update public.studios set created_at = now() where slug = 'estudio-f';

select is(pg_temp.claim('00000000-0000-0000-0000-0000000000d1', pg_temp.sid('estudio-d'), 'estudio-a'), 'true', 'D también viene de A');
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000e1', pg_temp.sid('estudio-e'), 'estudio-a'), 'true', 'E también viene de A');
select is(pg_temp.claim('00000000-0000-0000-0000-0000000000f1', pg_temp.sid('estudio-f'), 'estudio-a'), 'true', 'F también viene de A');

-- ---------------------------------------------------------------- lectura y resumen
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.studio_referrals'), '42501',
  'nadie lee la tabla directo');
select is(pg_temp.quote('00000000-0000-0000-0000-0000000000a1',
  $$public.studio_referral_summary('10000000-0000-0000-0000-00000000000a')$$) ->> 'pending', '4',
  'A ve sus 4 recomendaciones pendientes');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.studio_referral_summary('10000000-0000-0000-0000-00000000000a')$$), 'forbidden',
  'otro estudio no las ve');

-- ---------------------------------------------------------------- precio
select is(pg_temp.quote('00000000-0000-0000-0000-0000000000a1',
  $$public.giroa_quote('inicial', 'monthly', null, '10000000-0000-0000-0000-00000000000a')$$) ->> 'referral_pct', '0',
  'mientras nadie pague, no hay descuento por recomendar');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.giroa_quote('inicial', 'monthly', null, '10000000-0000-0000-0000-00000000000a')$$), 'forbidden',
  'no se puede pedir el precio de otro estudio');

-- C se suscribe y paga la primera cuota.
update public.studio_subscriptions set status = 'active', plan = 'inicial', billing_cycle = 'monthly', mp_preapproval_id = 'pre-c'
where studio_id = pg_temp.sid('estudio-c');
select is(tests.q('service_role', null, $$select public.giroa_apply_subscription_charge('pre-c', true) ->> 'referrer_studio_id' as r$$) -> 0 ->> 'r',
  '10000000-0000-0000-0000-00000000000a', 'el primer cobro de C premia a A');
select is((select status::text from public.studio_referrals where referred_studio_id = pg_temp.sid('estudio-c')), 'rewarded',
  'la recomendación queda cumplida');
select is(tests.q('service_role', null, $$select public.giroa_apply_subscription_charge('pre-c', true) ->> 'referrer_studio_id' as r$$) -> 0 ->> 'r',
  '10000000-0000-0000-0000-00000000000a', 'un cobro repetido devuelve igual a A (re-precio idempotente)');

select is(pg_temp.quote('00000000-0000-0000-0000-0000000000a1',
  $$public.giroa_quote('inicial', 'monthly', null, '10000000-0000-0000-0000-00000000000a')$$) ->> 'amount_cents', '1196000',
  'A ahora cotiza con fundador 50% + 10%');

-- Re-precio de la suscripción activa de A.
select is(tests.q('service_role', null, $$select public.giroa_reprice('10000000-0000-0000-0000-00000000000a') as j$$) -> 0 -> 'j',
  '{"changed": true, "amount_cents": 1196000, "referral_pct": 10, "preapproval_id": "pre-a"}'::jsonb,
  'A tiene que pasar a pagar 60% menos');
select tests.exec('service_role', null,
  $$select public.giroa_set_subscription_price('10000000-0000-0000-0000-00000000000a', 'pre-a', 1196000, 10::smallint)$$);
select is((select amount_cents || '/' || discount_pct || '/' || referral_discount_pct from public.studio_subscriptions
  where studio_id = '10000000-0000-0000-0000-00000000000a'), '1196000/60/10', 'el precio nuevo queda guardado');
select is(tests.q('service_role', null, $$select public.giroa_reprice('10000000-0000-0000-0000-00000000000a') ->> 'changed' as c$$) -> 0 ->> 'c',
  'false', 'ya no hay nada que cambiar');

-- Tres estudios pagos: 30% pasaría el tope, queda en 25%.
update public.studio_subscriptions set status = 'active', mp_preapproval_id = 'pre-' || right(s.slug, 1)
from public.studios s where s.id = studio_subscriptions.studio_id and s.slug in ('estudio-d', 'estudio-e');
select tests.exec('service_role', null, $$select public.giroa_apply_subscription_charge('pre-d', true)$$);
select tests.exec('service_role', null, $$select public.giroa_apply_subscription_charge('pre-e', true)$$);
select is(tests.q('service_role', null, $$select public.giroa_reprice('10000000-0000-0000-0000-00000000000a') ->> 'referral_pct' as c$$) -> 0 ->> 'c',
  '25', 'el descuento por recomendar tiene un tope de 25%');

-- Un cobro rechazado no premia.
update public.studio_subscriptions set status = 'active', mp_preapproval_id = 'pre-f' where studio_id = pg_temp.sid('estudio-f');
select tests.exec('service_role', null, $$select public.giroa_apply_subscription_charge('pre-f', false)$$);
select is((select status::text from public.studio_referrals where referred_studio_id = pg_temp.sid('estudio-f')), 'pending',
  'un cobro rechazado no cuenta');

-- ---------------------------------------------------------------- solo servidor
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.giroa_reprice('10000000-0000-0000-0000-00000000000a')$$), '42501', 'el re-precio es solo del servidor');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.giroa_set_subscription_price('10000000-0000-0000-0000-00000000000a', 'pre-a', 1, 25::smallint)$$), '42501',
  'y guardar el precio también');

select * from finish();
rollback;
