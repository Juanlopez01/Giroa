-- Anuncios: los publica el dueño o un encargado (plan Estudio), los ven sus
-- destinatarios y salen por mail a los que tienen email.
begin;
select plan(14);
select tests.fixture();

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.publish_announcement('10000000-0000-0000-0000-00000000000a', 'Feriado', 'Mañana no hay clase.')$$),
  'feature_unavailable', 'en el plan Inicial no hay anuncios');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.publish_announcement('10000000-0000-0000-0000-00000000000a', 'Feriado', 'Mañana no hay clase.')$$),
  'forbidden', 'el profe no publica anuncios');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.publish_announcement('10000000-0000-0000-0000-00000000000a', 'Trucho', 'De otro estudio.')$$),
  'forbidden', 'el dueño de otro estudio no puede');

-- A todos: Ana y Beto tienen email (Carla también, sin cuenta), Dani y Eli no.
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select (public.publish_announcement('10000000-0000-0000-0000-00000000000a', 'Feriado', 'Mañana no hay clase.') ->> 'emailed')::int as v$$) -> 0 ->> 'v',
  '3', 'encola un mail por cada alumno con email');
select is((select count(*)::integer from public.notifications where template = 'announcement'), 3, 'quedan 3 mails en la cola');

select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from public.announcements$$), 1, 'Ana ve el anuncio');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000b3',
  $$select 1 from public.announcements$$), 0, 'un alumno de otro estudio no lo ve');

-- A una clase: solo quien reservó yoga.
insert into public.bookings (studio_id, session_id, student_id, student_pack_id)
values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000a2',
        '30000000-0000-0000-0000-0000000000a2', '70000000-0000-0000-0000-0000000000a2');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.publish_announcement('10000000-0000-0000-0000-00000000000a', 'Yoga cambia de sala', 'Nos vemos en la sala 2.',
    'offering', '40000000-0000-0000-0000-0000000000a2', null, null, false)$$),
  'OK', 'publica a los de una clase, sin mail');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select 1 from public.announcements where audience = 'offering'$$), 1, 'Beto (reservó yoga) lo ve');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from public.announcements where audience = 'offering'$$), 0, 'Ana (no reservó yoga) no lo ve');
select is((select count(*)::integer from public.notifications where template = 'announcement'), 3, 'sin mail, no encola nada');

-- Cerrar el cartel.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.dismiss_announcement((select id from public.announcements where audience = 'all'))$$),
  'OK', 'Ana cierra el anuncio');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select 1 from public.announcement_dismissals$$), 1, 'queda registrado que lo cerró');

select isnt(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$insert into public.announcements (studio_id, title, body, audience) values ('10000000-0000-0000-0000-00000000000a', 'Hack', 'Hola', 'all')$$),
  'OK', 'nadie inserta anuncios directo en la tabla');

select * from finish();
rollback;
