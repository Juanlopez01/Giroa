-- Presente con el QR del estudio: el alumno escanea el cartel y se da el
-- presente en su clase (o en el encuentro de su formación) cerca del horario.
begin;
select plan(19);
select tests.fixture();

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

-- Código de A, en una variable de sesión para usarlo adentro de los $$.
select set_config('t.code', (select code from public.studio_checkin_codes
  where studio_id = '10000000-0000-0000-0000-00000000000a'), false);

select is((select count(*)::integer from public.studio_checkin_codes
  where studio_id in ('10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b')),
  2, 'cada estudio tiene su código');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from public.studio_checkin_codes$$), 0, 'el alumno no puede leer el código');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select 1 from public.studio_checkin_codes$$), 1, 'el profe ve solo el de su estudio');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.self_check_in('cualquiera')$$), 'invalid_code', 'un código inventado no sirve');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b3',
  $$select public.self_check_in(current_setting('t.code'))$$), 'not_a_student', 'un alumno de otro estudio no puede');

-- Ana no reservó la clase que empezó hace 10 minutos (a4): se le ofrece entrar.
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.self_check_in(current_setting('t.code')) ->> 'status' as v$$) -> 0 ->> 'v',
  'walk_in', 'sin reserva, ofrece reservar y dar el presente');

-- Beto sí reservó a4.
insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role)
values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000a4',
        '30000000-0000-0000-0000-0000000000a2', '70000000-0000-0000-0000-0000000000a2', 'follower');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.self_check_in(current_setting('t.code')) ->> 'status' as v$$) -> 0 ->> 'v',
  'checked_in', 'con reserva, se da el presente');
select is((select status::text from public.bookings where session_id = '50000000-0000-0000-0000-0000000000a4'
  and student_id = '30000000-0000-0000-0000-0000000000a2'), 'attended', 'la reserva queda como presente');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.self_check_in(current_setting('t.code')) ->> 'status' as v$$) -> 0 ->> 'v',
  'already', 'si escanea de nuevo, ya tiene el presente');

-- Ana entra sin reserva a la clase empezada: consume una clase.
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.self_check_in(current_setting('t.code'), '50000000-0000-0000-0000-0000000000a4') ->> 'status' as v$$) -> 0 ->> 'v',
  'checked_in', 'reserva y da el presente en un paso');
select is((select count(*)::integer from public.pack_credit_events
  where student_pack_id = '70000000-0000-0000-0000-0000000000a1' and kind = 'consume'),
  1, 'le descuenta una clase');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.self_check_in(current_setting('t.code'), '50000000-0000-0000-0000-0000000000a3')$$),
  'outside_window', 'una clase que empieza en 2 horas todavía no');

-- Sin clases en horario.
update public.sessions set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day'
where id = '50000000-0000-0000-0000-0000000000a4';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.self_check_in(current_setting('t.code'))$$), 'no_session_now', 'si no hay clase ahora, lo avisa');

-- Formación: Beto inscripto, encuentro que empieza en 20 minutos.
insert into public.formations (id, studio_id, title, starts_on, ends_on, status)
values ('a0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Profesorado',
        current_date, current_date + 300, 'published');
insert into public.formation_enrollments (id, studio_id, formation_id, student_id, status)
values ('a1000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a',
        'a0000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2', 'enrolled');
insert into public.formation_sessions (id, studio_id, formation_id, title, starts_at, ends_at)
values ('a2000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a',
        'a0000000-0000-0000-0000-0000000000a1', 'Encuentro 1', now() + interval '20 minutes', now() + interval '3 hours');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.self_check_in(current_setting('t.code'))$$), 'no_session_now', 'el encuentro no es para quien no está inscripto');

-- Con una cuota vencida, no.
insert into public.formation_charges (studio_id, enrollment_id, formation_id, kind, amount_cents, due_on)
values ('10000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1',
        'a0000000-0000-0000-0000-0000000000a1', 'installment', 100000, (current_date - interval '2 months')::date);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.self_check_in(current_setting('t.code'))$$), 'in_debt', 'con deuda no se da el presente');

update public.formation_charges set status = 'paid', method = 'cash', paid_at = now() where enrollment_id = 'a1000000-0000-0000-0000-0000000000a1';
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.self_check_in(current_setting('t.code')) ->> 'kind' as v$$) -> 0 ->> 'v',
  'formation', 'al día, se da el presente en el encuentro');
select is((select count(*)::integer from public.formation_attendance
  where formation_session_id = 'a2000000-0000-0000-0000-0000000000a1'), 1, 'queda la asistencia del encuentro');

-- Cambiar el QR.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.rotate_checkin_code('10000000-0000-0000-0000-00000000000a')$$), 'forbidden', 'el profe no puede cambiar el QR');
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.rotate_checkin_code('10000000-0000-0000-0000-00000000000a')$$);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.self_check_in(current_setting('t.code'))$$), 'invalid_code', 'el cartel viejo deja de valer');

select * from finish();
rollback;
