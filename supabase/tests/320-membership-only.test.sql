-- Pack solo por abono: online no se compra suelto ni se regala por MP; el
-- mostrador lo sigue vendiendo y los cobros del abono siguen entrando.
begin;
select plan(7);
select tests.fixture();

insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');
update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select throws_ok(
  $$update public.pack_products set membership_only = true where id = '60000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'solo puede ser "solo abono" un pack que es abono');

update public.pack_products set is_membership = true, membership_only = true where id = '60000000-0000-0000-0000-0000000000a1';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1')$$), 'membership_only', 'online no se compra suelto');
select is(tests.err_message('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.create_pack_payment('60000000-0000-0000-0000-0000000000a1')$$), 'Este pack es solo por abono mensual.', 'con un mensaje claro');
select is(tests.err('anon', null,
  $$select public.create_gift_card_order('60000000-0000-0000-0000-0000000000a1', 'Juan Pérez', 'juan@test.com')$$),
  'membership_only', 'ni se regala online');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000a5', '60000000-0000-0000-0000-0000000000a1', 'cash')$$),
  'OK', 'en el mostrador se sigue vendiendo');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.start_membership('60000000-0000-0000-0000-0000000000a1')$$), 'OK', 'abonarse sí se puede');

update public.student_subscriptions set mp_preapproval_id = 'pre1' where pack_product_id = '60000000-0000-0000-0000-0000000000a1';
select is(tests.err('service_role', null,
  $$select public.mp_apply_membership_charge('pre1', 'pay1', true, 3000000, now(), now() + interval '1 month')$$),
  'OK', 'y los cobros del abono entran');

select * from finish();
rollback;
