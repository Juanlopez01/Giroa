-- import_students: alta y actualización por email, saldo importado, errores por fila.
begin;
select plan(11);
select tests.fixture();

create temp table r (result jsonb);
grant all on r to authenticated, service_role;

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.import_students('10000000-0000-0000-0000-00000000000a', '[{"full_name":"X"}]')$$),
  'forbidden', 'el profe no importa');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.import_students('10000000-0000-0000-0000-00000000000a', '[{"full_name":"X"}]')$$),
  'forbidden', 'el owner de otro estudio no importa');

select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1', $$
  insert into r select public.import_students('10000000-0000-0000-0000-00000000000a', '[
    {"full_name":"Flor Nueva","email":"FLOR@test.com","phone":"11 1234","default_role":"follower","credits":6,"expires_on":"2030-12-31"},
    {"full_name":"Ana Repetida","email":"ana@test.com","credits":2,"expires_on":"2030-12-31"},
    {"full_name":"Gaby Libre","unlimited":true,"expires_on":"2030-12-31"},
    {"full_name":"","email":"sin-nombre@test.com"},
    {"full_name":"Sin vencimiento","credits":4},
    {"full_name":"Rol raro","default_role":"bailarín"}
  ]')
$$);

select is((select (result ->> 'created')::int from r), 2, 'crea 2 alumnos nuevos (Flor y Gaby)');
select is((select (result ->> 'updated')::int from r), 1, 'actualiza 1 que ya existía por email (Ana)');
select is((select (result ->> 'packs')::int from r), 3, 'carga 3 saldos');
select is((select jsonb_array_length(result -> 'errors') from r), 3, 'reporta 3 filas con error');
select is((select result -> 'errors' -> 0 ->> 'row' from r), '4', 'el error indica el número de fila');
select is((select result -> 'errors' -> 1 ->> 'message' from r), 'Tiene saldo pero falta la fecha de vencimiento.',
  'el error explica qué falta');

select is((select b.credits_remaining || ' ' || b.expires_on from public.student_balances b
  join public.students s on s.id = b.student_id where s.email = 'flor@test.com'),
  '6 2030-12-31', 'Flor tiene 6 clases que vencen el 31/12/2030 (email normalizado)');
select is((select count(*)::int from public.student_packs sp join public.students s on s.id = sp.student_id
  where s.email = 'ana@test.com'), 2, 'Ana suma el saldo importado a su pack');
select is((select note from public.pack_credit_events e join public.student_packs sp on sp.id = e.student_pack_id
  join public.students s on s.id = sp.student_id where s.email = 'flor@test.com'),
  'Saldo importado', 'queda en el historial como saldo importado');

select * from finish();
rollback;
