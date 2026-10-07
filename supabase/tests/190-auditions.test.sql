-- Audiciones: gating, formulario (obligatorios, opciones), video, turnos con
-- cupo, arancel con reserva y webhook, resultado que admite en la formación,
-- lista de espera y aislamiento.
begin;
select plan(22);
select tests.fixture();

insert into public.mp_connections (studio_id, mp_user_id, access_token_enc, refresh_token_enc, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '123', 'enc', 'enc', now() + interval '180 days');
insert into public.formations (id, studio_id, title, starts_on, ends_on, status, enrollment_fee_cents)
values ('a0000000-0000-4000-8000-0000000000f1', '10000000-0000-0000-0000-00000000000a', 'Profesorado',
        current_date + 30, current_date + 300, 'draft', 1000000);

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.auditions (studio_id, formation_id, title) values
    ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-4000-8000-0000000000f1', 'Audición 2027')$$),
  '42501', 'en plan Inicial no hay audiciones');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

insert into public.auditions (id, studio_id, formation_id, title, status, fee_cents, video_mode, uses_slots)
values ('d0000000-0000-4000-8000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-4000-8000-0000000000f1',
        'Audición 2027', 'open', 500000, 'required', true);
insert into public.audition_fields (id, studio_id, audition_id, label, kind, options, required, sort) values
  ('e1000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-00000000000a', 'd0000000-0000-4000-8000-0000000000a1', '¿Hace cuánto bailás?', 'short_text', '{}', true, 1),
  ('e1000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-00000000000a', 'd0000000-0000-4000-8000-0000000000a1', 'Nivel', 'choice', '{Inicial,Intermedio,Avanzado}', true, 2);
insert into public.audition_slots (id, studio_id, audition_id, starts_at, ends_at, capacity) values
  ('e2000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-00000000000a', 'd0000000-0000-4000-8000-0000000000a1', now() + interval '3 days', now() + interval '3 days 20 minutes', 1),
  ('e2000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-00000000000a', 'd0000000-0000-4000-8000-0000000000a1', now() + interval '3 days 20 minutes', now() + interval '3 days 40 minutes', 1);

select is(tests.count('anon', null, $$select id from public.audition_fields$$), 2, 'el formulario es público');

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1',
    '{"e1000000-0000-4000-8000-000000000002": "Intermedio"}', 'https://youtu.be/x', 'e2000000-0000-4000-8000-000000000001')$$),
  'missing_answer', 'pide las respuestas obligatorias');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1',
    '{"e1000000-0000-4000-8000-000000000001": "5 años", "e1000000-0000-4000-8000-000000000002": "Experto"}', 'https://youtu.be/x', 'e2000000-0000-4000-8000-000000000001')$$),
  'invalid_choice', 'una opción que no existe no vale');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1',
    '{"e1000000-0000-4000-8000-000000000001": "5 años", "e1000000-0000-4000-8000-000000000002": "Intermedio"}', null, 'e2000000-0000-4000-8000-000000000001')$$),
  'video_required', 'el video es obligatorio');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1',
    '{"e1000000-0000-4000-8000-000000000001": "5 años", "e1000000-0000-4000-8000-000000000002": "Intermedio", "inventado": "x"}',
    'https://youtu.be/ana', 'e2000000-0000-4000-8000-000000000001')$$),
  'OK', 'Ana se inscribe con el turno 1');
select is((select status::text || ' ' || fee_cents || ' ' || (answers ? 'inventado') from public.audition_applications
  where student_id = '30000000-0000-0000-0000-0000000000a1'), 'pending_payment 500000 false',
  'queda esperando el arancel y no guarda respuestas que no están en el formulario');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1',
    '{"e1000000-0000-4000-8000-000000000001": "2 años", "e1000000-0000-4000-8000-000000000002": "Inicial"}', 'https://youtu.be/b', 'e2000000-0000-4000-8000-000000000001')$$),
  'slot_full', 'el turno de Ana está reservado mientras paga');
select is((select remaining from public.audition_slot_availability('d0000000-0000-4000-8000-0000000000a1')
  where slot_id = 'e2000000-0000-4000-8000-000000000002'), 1, 'el turno 2 sigue libre');

-- Vence la reserva: se libera el turno.
update public.audition_applications set hold_expires_at = now() - interval '1 minute' where student_id = '30000000-0000-0000-0000-0000000000a1';
select is((select remaining from public.audition_slot_availability('d0000000-0000-4000-8000-0000000000a1')
  where slot_id = 'e2000000-0000-4000-8000-000000000001'), 1, 'con la reserva vencida el turno se libera');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1',
    '{"e1000000-0000-4000-8000-000000000001": "5 años", "e1000000-0000-4000-8000-000000000002": "Intermedio"}', 'https://youtu.be/ana', 'e2000000-0000-4000-8000-000000000001')$$),
  'OK', 'Ana puede volver a intentar (reserva de nuevo)');

-- Webhook
select is(tests.err('service_role', null,
  $$select public.mp_apply_audition_payment((select external_reference from public.audition_applications
    where student_id = '30000000-0000-0000-0000-0000000000a1'), 'mp-1', 'approved', 500000)$$),
  'OK', 'MP aprueba el arancel');
select is((select status::text from public.audition_applications where student_id = '30000000-0000-0000-0000-0000000000a1'), 'submitted',
  'queda inscripta a la audición');
select is((select count(*)::integer from public.notifications where template = 'audition_submitted'
  and student_id = '30000000-0000-0000-0000-0000000000a1'), 1, 'y le llega la confirmación');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1', '{}', null, null)$$),
  'already_applied', 'no se inscribe dos veces');

-- Mostrador: Beto paga en efectivo.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.apply_to_audition('d0000000-0000-4000-8000-0000000000a1',
    '{"e1000000-0000-4000-8000-000000000001": "2 años", "e1000000-0000-4000-8000-000000000002": "Inicial"}', 'https://youtu.be/b', 'e2000000-0000-4000-8000-000000000002')$$);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.record_audition_payment((select id from public.audition_applications where student_id = '30000000-0000-0000-0000-0000000000a2'), 'cash')$$),
  'OK', 'el owner registra el arancel de Beto en efectivo');

-- Resultados
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.set_audition_result((select id from public.audition_applications where student_id = '30000000-0000-0000-0000-0000000000a1'), 'admitted')$$),
  'application_not_found', 'el profe no pone resultados');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.set_audition_result((select id from public.audition_applications where student_id = '30000000-0000-0000-0000-0000000000a1'), 'admitted')$$),
  'OK', 'el owner admite a Ana');
select is((select e.status::text || ' ' || (select count(*) from public.formation_charges c where c.enrollment_id = e.id and c.kind = 'enrollment')
  from public.formation_enrollments e where e.student_id = '30000000-0000-0000-0000-0000000000a1'), 'approved 1',
  'queda aprobada en la formación, con la matrícula para pagar');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.set_audition_result((select id from public.audition_applications where student_id = '30000000-0000-0000-0000-0000000000a2'), 'waitlisted')$$),
  'OK', 'Beto queda en lista de espera');
select is((select count(*)::integer from public.notifications where template = 'audition_result'
  and payload ->> 'result' = 'waitlisted'), 1, 'y se le avisa');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4', $$select id from public.audition_applications$$), 1,
  'Beto ve solo su inscripción');

select * from finish();
rollback;
