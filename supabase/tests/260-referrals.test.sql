-- Referidos: el amigo se anota con el código de quien lo invitó y, cuando paga
-- su primer pack, los dos reciben clases de regalo.
begin;
select plan(14);
select tests.fixture();

-- Usuario nuevo (Nico) que se suma al estudio A.
select tests.create_user('00000000-0000-0000-0000-0000000000a9', 'nico@test.com');
insert into public.students (id, studio_id, user_id, full_name, email)
values ('30000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a9', 'Nico Paz', 'nico@test.com');

select ok((select referral_code ~ '^[A-Z2-9]{6}$' from public.students where id = '30000000-0000-0000-0000-0000000000a9'),
  'cada alumno tiene su código');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.students (studio_id, full_name) values ('10000000-0000-0000-0000-00000000000a', 'Alta desde el panel')$$),
  'OK', 'el staff sigue pudiendo dar de alta alumnos (el código se genera solo)');

select set_config('t.ana_code', (select referral_code from public.students where id = '30000000-0000-0000-0000-0000000000a1'), false);

-- En el plan Inicial no hay referidos.
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a9',
  format($$select public.claim_referral('10000000-0000-0000-0000-00000000000a', %L) as v$$, current_setting('t.ana_code'))) -> 0 ->> 'v',
  'false', 'en el plan Inicial no se anota');

update public.studios set plan = 'estudio', referral_credits = 2 where id = '10000000-0000-0000-0000-00000000000a';
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a9',
  $$select public.claim_referral('10000000-0000-0000-0000-00000000000a', 'NOEXISTE') as v$$) -> 0 ->> 'v',
  'false', 'un código inválido no frena nada');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  format($$select public.claim_referral('10000000-0000-0000-0000-00000000000a', %L) as v$$, current_setting('t.ana_code'))) -> 0 ->> 'v',
  'false', 'no se puede usar el código propio');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a9',
  format($$select public.claim_referral('10000000-0000-0000-0000-00000000000a', lower(%L)) as v$$, current_setting('t.ana_code'))) -> 0 ->> 'v',
  'true', 'Nico se anota con el código de Ana');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a9',
  format($$select public.claim_referral('10000000-0000-0000-0000-00000000000a', %L) as v$$,
    (select referral_code from public.students where id = '30000000-0000-0000-0000-0000000000a2'))) -> 0 ->> 'v',
  'false', 'y no puede cambiar de padrino');

-- Quién lo ve.
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', $$select 1 from public.referrals$$), 1, 'Ana ve su invitado');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4', $$select 1 from public.referrals$$), 0, 'Beto no');

-- Un pago pendiente no da nada; el aprobado, sí, a los dos.
select tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select (public.record_manual_payment('30000000-0000-0000-0000-0000000000a9', '60000000-0000-0000-0000-0000000000a1', 'cash')) ->> 'payment_id' as v$$);
select is((select status::text || '/' || credits from public.referrals where referred_student_id = '30000000-0000-0000-0000-0000000000a9'),
  'rewarded/2', 'con el primer pack pago, el referido queda premiado');
select is((select credits_total from public.student_packs where student_id = '30000000-0000-0000-0000-0000000000a9' and name = 'Regalo de bienvenida'),
  2, 'Nico recibe sus clases de regalo');
select is((select name from public.student_packs where student_id = '30000000-0000-0000-0000-0000000000a1' and payment_id is null and name like 'Regalo%'),
  'Regalo por invitar a Nico', 'y Ana también');

-- Un segundo pago no vuelve a premiar.
select tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select (public.record_manual_payment('30000000-0000-0000-0000-0000000000a9', '60000000-0000-0000-0000-0000000000a1', 'cash')) ->> 'payment_id' as v$$);
select is((select count(*)::integer from public.student_packs where student_id = '30000000-0000-0000-0000-0000000000a1' and name like 'Regalo por invitar%'),
  1, 'el segundo pago no da otro regalo');

-- Un alumno de hace tiempo no se puede anotar como invitado.
update public.students set created_at = now() - interval '30 days' where id = '30000000-0000-0000-0000-0000000000a2';
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a4',
  format($$select public.claim_referral('10000000-0000-0000-0000-00000000000a', %L) as v$$, current_setting('t.ana_code'))) -> 0 ->> 'v',
  'false', 'un alumno de hace tiempo no se anota como invitado');

select * from finish();
rollback;
