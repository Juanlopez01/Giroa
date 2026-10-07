-- Equipo: invitar, aceptar con el email correcto, permisos de cobro, cambios
-- de rol, sacar del equipo y aislamiento.
begin;
select plan(22);
select tests.fixture();

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.invite_member('10000000-0000-0000-0000-00000000000a', 'nueva@test.com', 'teacher', 'Nueva Profe')$$),
  'feature_not_in_plan', 'en plan Inicial no se puede sumar gente');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.invite_member('10000000-0000-0000-0000-00000000000a', 'nueva@test.com', 'teacher')$$),
  'forbidden', 'un profe no invita');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.invite_member('10000000-0000-0000-0000-00000000000a', 'nueva@test.com', 'owner')$$),
  'invalid_role', 'no se puede invitar como dueño');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.invite_member('10000000-0000-0000-0000-00000000000a', 'ana@test.com', 'teacher')$$),
  'OK', 'se puede invitar a alguien que hoy es alumna');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  format('select public.invite_member(%L, %L, %L)', '10000000-0000-0000-0000-00000000000a',
    (select email from auth.users where id = '00000000-0000-0000-0000-0000000000a2'), 'teacher')),
  'already_member', 'no se invita a quien ya está en el equipo');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.invite_member('10000000-0000-0000-0000-00000000000a', 'Sin.Cuenta@Test.com', 'teacher', 'Sofi', true)$$),
  'OK', 'el owner invita a una profe que puede cobrar');
select is((select count(*)::integer from public.notifications where template = 'staff_invite' and to_address = 'sin.cuenta@test.com'), 1,
  'se encola el mail de invitación (email en minúsculas)');
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.invite_member('10000000-0000-0000-0000-00000000000a', 'sin.cuenta@test.com', 'teacher', null, true)$$);
select is((select count(*)::integer from public.studio_invites where email = 'sin.cuenta@test.com'), 1,
  'reenviar no duplica la invitación');
select is((select count(*)::integer from public.notifications where template = 'staff_invite' and to_address = 'sin.cuenta@test.com'), 2,
  'pero manda otro mail');

-- RLS de invitaciones
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2', $$select id from public.studio_invites$$), 0,
  'el profe no ve las invitaciones');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b1', $$select id from public.studio_invites$$), 0,
  'el owner de B no ve las de A');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1', $$select token from public.studio_invites$$),
  '42501', 'el token no se puede leer desde la API');

-- Aceptar: Beto intenta usar la invitación de Ana.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  format('select public.accept_invite(%L)', (select token from public.studio_invites where email = 'ana@test.com'))),
  'wrong_email', 'otra persona no puede aceptar la invitación');
select is(tests.q('anon', null,
  format('select public.get_invite(%L) as i', (select token from public.studio_invites where email = 'ana@test.com'))) -> 0 -> 'i' ->> 'status',
  'pending', 'la pantalla de la invitación ve que está pendiente');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format('select public.accept_invite(%L)', (select token from public.studio_invites where email = 'ana@test.com'))),
  'OK', 'Ana acepta con su email');
select is((select role::text from public.studio_members where user_id = '00000000-0000-0000-0000-0000000000a3'
  and studio_id = '10000000-0000-0000-0000-00000000000a'), 'teacher', 'y queda como profe');

update public.studio_invites set expires_at = now() - interval '1 minute' where email = 'sin.cuenta@test.com';
select is(tests.q('anon', null,
  format('select public.get_invite(%L) as i', (select token from public.studio_invites where email = 'sin.cuenta@test.com'))) -> 0 -> 'i' ->> 'status',
  'expired', 'una invitación vencida figura como vencida');

-- Permiso de cobro: el profe del fixture (sin permiso) y Ana (sin permiso).
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000a5', '60000000-0000-0000-0000-0000000000a1', 'cash')$$),
  'cannot_take_payments', 'un profe sin permiso no registra pagos');
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.update_member('20000000-0000-0000-0000-0000000000a2', 'teacher', true)$$);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.record_manual_payment('30000000-0000-0000-0000-0000000000a5', '60000000-0000-0000-0000-0000000000a1', 'cash')$$),
  'OK', 'con "puede cobrar" sí');

-- Dueño y uno mismo.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.remove_member('20000000-0000-0000-0000-0000000000a1')$$),
  'is_owner', 'al dueño no se lo puede sacar');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.remove_member('20000000-0000-0000-0000-0000000000a2')$$),
  'member_not_found', 'el owner de B no saca gente de A');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.remove_member('20000000-0000-0000-0000-0000000000a2')$$),
  'OK', 'el owner saca al profe');

select * from finish();
rollback;
