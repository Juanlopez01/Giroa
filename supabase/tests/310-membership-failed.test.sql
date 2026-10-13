-- Rebote de un abono: avisa al alumno y a dueños/encargados (no a los profes),
-- una sola vez mientras MP reintenta, y de nuevo si rebota después de un cobro bueno.
begin;
select plan(6);
select tests.fixture();

insert into public.student_subscriptions (id, studio_id, student_id, pack_product_id, name, amount_cents, status, mp_preapproval_id)
values ('a0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a1',
  '60000000-0000-0000-0000-0000000000a1', '8 clases', 3000000, 'active', 'pre1');

select tests.q('service_role', null, $$select public.mp_apply_membership_charge('pre1', 'pay1', false, 3000000, null, null, 'Fondos insuficientes') as v$$);

select is((select to_address || '/' || (payload ->> 'name') from public.notifications where template = 'membership_failed'),
  'ana@test.com/8 clases', 'le avisa a la alumna');
select is((select string_agg(to_address || ':' || (payload ->> 'student_name') || ':' || (payload ->> 'error'), ',') from public.notifications
  where template = 'membership_failed_staff'),
  'owner-a@test.com:Ana:Fondos insuficientes', 'y al dueño con el motivo (al profe no)');

-- MP reintenta y vuelve a fallar; después pausa el débito: no repite.
select tests.q('service_role', null, $$select public.mp_apply_membership_charge('pre1', 'pay2', false, 3000000, null, null, 'Fondos insuficientes') as v$$);
select tests.q('service_role', null, $$select public.mp_apply_membership('a0000000-0000-0000-0000-0000000000a1', 'pre1', 'paused') as v$$);
select is((select count(*)::integer from public.notifications where template like 'membership_failed%'), 2,
  'los reintentos no mandan más mails');

-- Se recupera y más adelante rebota otra vez: avisa de nuevo.
select tests.q('service_role', null, $$select public.mp_apply_membership_charge('pre1', 'pay3', true, 3000000, now(), now() + interval '1 month') as v$$);
select is((select failed_at from public.student_subscriptions where id = 'a0000000-0000-0000-0000-0000000000a1'), null,
  'el cobro bueno limpia el rebote');
update public.student_subscriptions set status = 'past_due', failed_at = now() + interval '1 day'
where id = 'a0000000-0000-0000-0000-0000000000a1';
select is((select count(*)::integer from public.notifications where template = 'membership_failed'), 2,
  'un rebote nuevo vuelve a avisar');

-- Un abono cancelado no avisa.
update public.student_subscriptions set status = 'cancelled', failed_at = null where id = 'a0000000-0000-0000-0000-0000000000a1';
update public.student_subscriptions set failed_at = now() + interval '2 days' where id = 'a0000000-0000-0000-0000-0000000000a1';
select is((select count(*)::integer from public.notifications where template = 'membership_failed'), 2,
  'un abono dado de baja no avisa');

select * from finish();
rollback;
