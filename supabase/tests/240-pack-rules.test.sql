-- Packs con restricciones: disciplina o clase, días y horario. Se usa el pack
-- que sirve y vence antes; si ninguno sirve, se avisa cuál no vale.
begin;
select plan(12);
select tests.fixture();

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

-- "Solo yoga", que vence antes que el pack general de Ana.
insert into public.pack_products (id, studio_id, name, credits, validity_days, price_cents, rules)
values ('60000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-00000000000a', 'Solo yoga', 4, 15, 1000000,
        '{"disciplines": ["yoga"]}');
insert into public.student_packs (id, studio_id, student_id, pack_product_id, name, credits_total, expires_at)
values ('70000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a1',
        '60000000-0000-0000-0000-0000000000a9', 'Solo yoga', 4, now() + interval '15 days');

select is((select rules ->> 'disciplines' from public.student_packs where id = '70000000-0000-0000-0000-0000000000a9'),
  '["yoga"]', 'el pack del alumno hereda las restricciones del producto');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'OK', 'Ana reserva yoga');
select is((select student_pack_id::text from public.bookings where session_id = '50000000-0000-0000-0000-0000000000a2'
  and student_id = '30000000-0000-0000-0000-0000000000a1'), '70000000-0000-0000-0000-0000000000a9', 'usa el pack de yoga (vence antes)');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a1', 'leader')$$), 'OK', 'Ana reserva tango');
select is((select student_pack_id::text from public.bookings where session_id = '50000000-0000-0000-0000-0000000000a1'
  and student_id = '30000000-0000-0000-0000-0000000000a1'), '70000000-0000-0000-0000-0000000000a1', 'para tango usa el pack general');

-- Sin el pack general, tango no se puede con el de yoga.
update public.student_packs set credits_used = credits_total where id = '70000000-0000-0000-0000-0000000000a1';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3', 'leader')$$), 'pack_not_valid', 'el pack de yoga no vale para tango');
select is(tests.err_message('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a3', 'leader')$$),
  'El pack «Solo yoga» no vale para esta clase.', 'y lo dice con el nombre del pack');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.check_in('50000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000a1')$$),
  'pack_not_valid', 'el presente sin reserva también respeta la restricción');

-- Días: un pack que vale solo otro día de la semana.
update public.student_packs
set rules = jsonb_build_object('weekdays', jsonb_build_array(
  ((extract(dow from (now() + interval '1 day') at time zone 'America/Argentina/Buenos_Aires')::int + 1) % 7)))
where id = '70000000-0000-0000-0000-0000000000a9';
update public.bookings set status = 'cancelled', cancelled_at = now() where session_id = '50000000-0000-0000-0000-0000000000a2';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'pack_not_valid', 'no vale otro día de la semana');

update public.student_packs
set rules = jsonb_build_object('weekdays', jsonb_build_array(
  extract(dow from (now() + interval '1 day') at time zone 'America/Argentina/Buenos_Aires')::int))
where id = '70000000-0000-0000-0000-0000000000a9';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'OK', 'sí vale el día permitido');

-- Horario: "antes de" la hora de la clase no sirve.
update public.bookings set status = 'cancelled', cancelled_at = now()
where session_id = '50000000-0000-0000-0000-0000000000a2' and status = 'booked';
update public.student_packs
set rules = jsonb_build_object('until', to_char((now() + interval '1 day') at time zone 'America/Argentina/Buenos_Aires' - interval '1 hour', 'HH24:MI'))
where id = '70000000-0000-0000-0000-0000000000a9';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'pack_not_valid', 'no vale después del horario permitido');

-- Sin restricciones vuelve a valer.
update public.student_packs set rules = '{}' where id = '70000000-0000-0000-0000-0000000000a9';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.book_session('50000000-0000-0000-0000-0000000000a2')$$), 'OK', 'sin restricciones vale para todo');

select * from finish();
rollback;
