-- Congelar packs: no se usa ni vence; al descongelar se corre el vencimiento.
begin;
select plan(13);
select tests.fixture();

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.freeze_pack('70000000-0000-0000-0000-0000000000a1')$$), 'feature_unavailable', 'en el plan Inicial no se congela');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.freeze_pack('70000000-0000-0000-0000-0000000000a1')$$), 'pack_not_found', 'el alumno no congela su pack');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.freeze_pack('70000000-0000-0000-0000-0000000000a1')$$), 'pack_not_found', 'el profe sin permiso de cobro tampoco');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.freeze_pack('70000000-0000-0000-0000-0000000000a1')$$), 'pack_not_found', 'otro estudio tampoco');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.freeze_pack('70000000-0000-0000-0000-0000000000a1', (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1)$$), 'invalid_date', 'no se congela hasta una fecha pasada');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.freeze_pack('70000000-0000-0000-0000-0000000000a1', (now() at time zone 'America/Argentina/Buenos_Aires')::date + 10)$$), 'OK', 'el dueño congela el pack de Ana');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.freeze_pack('70000000-0000-0000-0000-0000000000a1')$$), 'already_frozen', 'no se congela dos veces');

-- Congelado: no sirve para reservar y no vence.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'no_credits', 'con el pack congelado no puede reservar');
update public.student_packs set starts_at = now() - interval '20 days', expires_at = now() - interval '1 minute', frozen_at = now() - interval '5 days'
where id = '70000000-0000-0000-0000-0000000000a1';
select tests.q('service_role', null, $$select public.expire_packs() as n$$);
select is((select status::text from public.student_packs where id = '70000000-0000-0000-0000-0000000000a1'), 'frozen', 'congelado no vence');

-- Al descongelar se corre el vencimiento por los días congelados (5).
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.unfreeze_pack('70000000-0000-0000-0000-0000000000a1')$$), 'OK', 'el dueño lo descongela');
select ok((select status = 'active' and expires_at > now() + interval '4 days' and frozen_until is null
  from public.student_packs where id = '70000000-0000-0000-0000-0000000000a1'), 'vuelve a estar vigente con 5 días más');

-- Descongelado automático al pasar la fecha.
update public.student_packs set status = 'frozen', frozen_at = now() - interval '3 days', frozen_until = current_date - 2
where id = '70000000-0000-0000-0000-0000000000a2';
select is(tests.q('service_role', null, $$select public.unfreeze_due_packs() as n$$) -> 0 ->> 'n', '1', 'el cron descongela el que llegó a su fecha');
select is((select status::text from public.student_packs where id = '70000000-0000-0000-0000-0000000000a2'), 'active', 'y queda vigente');

select * from finish();
rollback;
