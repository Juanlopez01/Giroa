-- remove_schedule: borra sesiones futuras sin reservas y conserva las que tienen gente.
begin;
select plan(6);
select tests.fixture();

insert into public.class_schedules (id, studio_id, offering_id, weekday, start_time, duration_minutes) values
  ('80000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a',
   '40000000-0000-0000-0000-0000000000a1', 2, '19:00', 90);

select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.generate_sessions('10000000-0000-0000-0000-00000000000a', current_date + 1, 3) as n$$) -> 0 ->> 'n'),
  '3', 'se generan 3 martes');

-- Ana reserva el primero de esos martes.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a3', format(
  'select public.book_session(%L)',
  (select id from public.sessions where schedule_id = '80000000-0000-0000-0000-0000000000a1' order by starts_at limit 1)));

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.remove_schedule('80000000-0000-0000-0000-0000000000a1')$$), 'schedule_not_found',
  'el profe no puede quitar horarios');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.remove_schedule('80000000-0000-0000-0000-0000000000a1')$$), 'schedule_not_found',
  'el owner de otro estudio no puede quitar horarios');

select is((tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.remove_schedule('80000000-0000-0000-0000-0000000000a1') as n$$) -> 0 ->> 'n'),
  '1', 'el owner quita el horario: queda 1 clase con reserva');
select is((select count(*)::integer from public.class_schedules where id = '80000000-0000-0000-0000-0000000000a1'), 0,
  'el horario ya no existe');
select is((select count(*)::integer from public.bookings b join public.sessions s on s.id = b.session_id
  where b.student_id = '30000000-0000-0000-0000-0000000000a1' and s.schedule_id is null and b.status = 'booked'), 1,
  'la reserva de Ana sigue en pie');

select * from finish();
rollback;
