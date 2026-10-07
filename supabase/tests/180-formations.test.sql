-- Formaciones: gating y límite por plan, postulación con aprobación del
-- estudio, matrícula por MP, cuotas, deuda al día 10, asistencia con QR,
-- pago total con descuento, notas, cupo y aislamiento.
begin;
select plan(27);
select tests.fixture();

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.formations (studio_id, title, starts_on, ends_on)
    values ('10000000-0000-0000-0000-00000000000a', 'Profesorado', current_date, current_date + 200)$$),
  '42501', 'en plan Inicial no hay formaciones');

update public.studios set plan = 'estudio' where id = '10000000-0000-0000-0000-00000000000a';

insert into public.formations (id, studio_id, title, starts_on, ends_on, status, capacity, enrollment_fee_cents,
  installments_count, installment_cents, first_due_on) values
  ('a0000000-0000-4000-8000-0000000000f1', '10000000-0000-0000-0000-00000000000a', 'Profesorado de tango',
   current_date, current_date + 240, 'published', 2, 1000000, 3, 400000, current_date + 30);
insert into public.formations (id, studio_id, title, starts_on, ends_on, status, requires_approval, installments_count,
  installment_cents, first_due_on, full_payment_cents) values
  ('a0000000-0000-4000-8000-0000000000f2', '10000000-0000-0000-0000-00000000000a', 'Intensivo de verano',
   current_date, current_date + 60, 'published', false, 2, 500000, current_date + 30, 800000);

select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$insert into public.formations (studio_id, title, starts_on, ends_on, status)
    values ('10000000-0000-0000-0000-00000000000a', 'Tercera', current_date, current_date + 30, 'published')$$),
  'formation_limit', 'el plan Estudio permite hasta 2 publicadas');
select is(tests.count('anon', null,
  $$select id from public.formations where studio_id = '10000000-0000-0000-0000-00000000000a'$$), 2,
  'el público ve las formaciones publicadas');

-- Postulación con aprobación.
insert into public.students (id, studio_id, user_id, full_name, email)
values ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Lía', 'lia@test.com');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.apply_to_formation('a0000000-0000-4000-8000-0000000000f1', 'Bailo hace 5 años')$$),
  'OK', 'Ana se postula');
select is((select status::text from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a1'
  and formation_id = 'a0000000-0000-4000-8000-0000000000f1'), 'applied', 'queda postulada, esperando al estudio');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.decide_enrollment((select id from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a1'), true)$$),
  'enrollment_not_found', 'el profe no decide');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $$select public.decide_enrollment((select id from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a1'), true)$$),
  'enrollment_not_found', 'el owner de B tampoco');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.decide_enrollment((select id from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a1'), true, 'Muy buena audición')$$),
  'OK', 'el owner la aprueba');
select is((select count(*)::integer from public.formation_charges c join public.formation_enrollments e on e.id = c.enrollment_id
  where e.student_id = '30000000-0000-0000-0000-0000000000a1' and c.kind = 'enrollment' and c.amount_cents = 1000000), 1,
  'se le genera la matrícula para pagar');
select is((select count(*)::integer from public.notifications where template = 'formation_approved'
  and student_id = '30000000-0000-0000-0000-0000000000a1'), 1, 'y le avisamos por mail');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select staff_notes from public.formation_enrollments$$), '42501', 'la alumna no ve las notas internas');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select id from public.formation_charges$$), 0, 'Beto no ve los cobros de Ana');

-- Rechazo y cupo.
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.apply_to_formation('a0000000-0000-4000-8000-0000000000f1')$$);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.decide_enrollment((select id from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000c1'), false)$$);
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $$select public.apply_to_formation('a0000000-0000-4000-8000-0000000000f1')$$),
  'already_applied', 'rechazada no se puede volver a postular sola');
update public.formations set capacity = 1 where id = 'a0000000-0000-4000-8000-0000000000f1';
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.apply_to_formation('a0000000-0000-4000-8000-0000000000f1')$$),
  'formation_full', 'con el cupo lleno no se puede postular');

-- Matrícula por MP → inscripta con cuotas.
select is(tests.err('service_role', null,
  $$select public.mp_apply_formation_payment((select c.external_reference from public.formation_charges c
    join public.formation_enrollments e on e.id = c.enrollment_id where e.student_id = '30000000-0000-0000-0000-0000000000a1'
    and c.kind = 'enrollment'), 'mp-77', 'approved', 1000000)$$),
  'OK', 'MP aprueba la matrícula');
select is((select e.status::text || ' ' || (select count(*) from public.formation_charges c where c.enrollment_id = e.id and c.kind = 'installment')
  from public.formation_enrollments e where e.student_id = '30000000-0000-0000-0000-0000000000a1' and e.formation_id = 'a0000000-0000-4000-8000-0000000000f1'),
  'enrolled 3', 'queda inscripta y se generan las 3 cuotas');

-- Deuda: la cuota 1 venció el mes pasado (ya pasó el día 10).
update public.formation_charges c set due_on = (date_trunc('month', current_date) - interval '1 month')::date
from public.formation_enrollments e
where e.id = c.enrollment_id and e.student_id = '30000000-0000-0000-0000-0000000000a1' and c.kind = 'installment' and c.number = 1;
insert into public.formation_sessions (id, studio_id, formation_id, title, starts_at, ends_at) values
  ('b0000000-0000-4000-8000-0000000000e1', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-4000-8000-0000000000f1',
   'Encuentro 1', now() - interval '1 hour', now() + interval '1 hour');
select is(tests.q('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $$select public.enrollment_progress((select id from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a1'
    and formation_id = 'a0000000-0000-4000-8000-0000000000f1')) as p$$) -> 0 -> 'p' ->> 'in_debt',
  'true', 'Ana ve que tiene una cuota vencida');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  format('select public.formation_check_in(%L, null, %L)', 'b0000000-0000-4000-8000-0000000000e1',
    (select qr_token from public.students where id = '30000000-0000-0000-0000-0000000000a1'))),
  'in_debt', 'con deuda no se le da el presente');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.record_formation_payment((select c.id from public.formation_charges c join public.formation_enrollments e on e.id = c.enrollment_id
    where e.student_id = '30000000-0000-0000-0000-0000000000a1' and c.kind = 'installment' and c.number = 1), 'cash')$$),
  'cannot_take_payments', 'un profe sin permiso no cobra cuotas');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.record_formation_payment((select c.id from public.formation_charges c join public.formation_enrollments e on e.id = c.enrollment_id
    where e.student_id = '30000000-0000-0000-0000-0000000000a1' and c.kind = 'installment' and c.number = 1), 'cash')$$),
  'OK', 'el owner registra el pago en efectivo');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  format('select public.formation_check_in(%L, null, %L)', 'b0000000-0000-4000-8000-0000000000e1',
    (select qr_token from public.students where id = '30000000-0000-0000-0000-0000000000a1'))),
  'OK', 'al día, el profe le da el presente con el QR');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  format('select public.formation_check_in(%L, null, %L)', 'b0000000-0000-4000-8000-0000000000e1',
    (select qr_token from public.students where id = '30000000-0000-0000-0000-0000000000a2'))),
  'not_enrolled', 'Beto no está inscripto');

-- Sin aprobación, matrícula $0: queda inscripto al toque. Pago total con descuento.
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.apply_to_formation('a0000000-0000-4000-8000-0000000000f2')$$),
  'OK', 'Beto se anota al intensivo (sin aprobación)');
select is((select status::text from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a2'), 'enrolled',
  'queda inscripto directo');
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a4',
  $$select public.choose_full_payment((select id from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a2'))$$);
select tests.exec('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $$select public.record_formation_payment((select c.id from public.formation_charges c join public.formation_enrollments e on e.id = c.enrollment_id
    where e.student_id = '30000000-0000-0000-0000-0000000000a2' and c.kind = 'full'), 'transfer')$$);
select is((select string_agg(c.kind::text || ':' || c.status::text, ',' order by c.kind, c.number) from public.formation_charges c
  join public.formation_enrollments e on e.id = c.enrollment_id where e.student_id = '30000000-0000-0000-0000-0000000000a2'),
  'installment:cancelled,installment:cancelled,full:paid', 'al pagar el total, las cuotas quedan sin efecto');

-- Notas
insert into public.formation_assessments (id, studio_id, formation_id, title) values
  ('c0000000-0000-4000-8000-0000000000d1', '10000000-0000-0000-0000-00000000000a', 'a0000000-0000-4000-8000-0000000000f1', 'Coreografía final');
select is(tests.err('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $$select public.formation_set_grade('c0000000-0000-4000-8000-0000000000d1',
    (select id from public.formation_enrollments where student_id = '30000000-0000-0000-0000-0000000000a1'
     and formation_id = 'a0000000-0000-4000-8000-0000000000f1'), null, true, 'Muy bien')$$),
  'OK', 'el profe carga "aprobado"');
select is(tests.count('authenticated', '00000000-0000-0000-0000-0000000000a3', $$select assessment_id from public.formation_grades where passed$$), 1,
  'Ana ve su nota');

select * from finish();
rollback;
