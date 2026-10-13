-- =============================================================================
-- Estudio demo para ventas: "Tango del Sur" (slug demo) + una clase de yoga.
-- Se puede correr las veces que quieras: borra el demo anterior y lo recrea.
--
-- Uso:
--   Local:      npm run db:demo  (o psql ... -f supabase/seed-demo.sql)
--   Producción: pegarlo en el SQL Editor de Supabase.
-- Para administrarlo, cambiá owner_email por el email con el que entrás a
-- Giroa (tiene que haber entrado al menos una vez).
-- =============================================================================

do $demo$
declare
  owner_email text := 'duena@giroa.test';
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_studio uuid;
  v_owner uuid;
  o_inicial uuid;
  o_inter uuid;
  o_practica uuid;
  o_yoga uuid;
  p4 uuid;
  p8 uuid;
  plibre uuid;
  ppareja uuid;
  v_names text[] := array[
    'Lucía Fernández', 'Martín Gómez', 'Sofía Rodríguez', 'Juan Pérez', 'Valentina López', 'Mateo Díaz',
    'Camila Martínez', 'Santiago Romero', 'Martina Sosa', 'Tomás Álvarez', 'Florencia Torres', 'Nicolás Ruiz',
    'Agustina Ramírez', 'Facundo Flores', 'Julieta Acosta', 'Ignacio Benítez', 'Micaela Medina', 'Federico Herrera',
    'Paula Aguirre', 'Gonzalo Castro', 'Carolina Giménez', 'Joaquín Molina', 'Antonella Vega', 'Diego Ortiz'
  ];
  v_student uuid;
  v_students uuid[] := '{}';
  v_roles public.dance_role[] := '{}';
  v_pack uuid;
  v_payment uuid;
  v_product uuid;
  v_price bigint;
  v_credits integer;
  v_days_ago integer;
  i integer;
  v_session record;
  v_taken integer;
  v_leaders integer;
  v_followers integer;
  v_target integer;
  v_role public.dance_role;
  v_paid_at timestamptz;
  -- Formación y milonga
  v_today date;
  v_f uuid;
  v_enr uuid;
  v_start date;
  v_first_due date;
  v_last_due date;
  v_due date;
  v_debt boolean;
  v_e uuid;
  v_ant uuid;
  v_pre uuid;
  v_o uuid;
  v_party date;
  v_qty integer;
  n integer;
begin
  perform setseed(0.42);

  -- ---------------------------------------------------------------- limpiar demo anterior
  select id into v_studio from public.studios where slug = 'demo';
  if v_studio is not null then
    delete from public.pack_credit_events where studio_id = v_studio;
    delete from public.bookings where studio_id = v_studio;
    delete from public.notifications where studio_id = v_studio;
    delete from public.event_tickets where studio_id = v_studio;
    delete from public.event_orders where studio_id = v_studio;
    delete from public.event_ticket_types where studio_id = v_studio;
    delete from public.events where studio_id = v_studio;
    delete from public.formation_attendance where studio_id = v_studio;
    delete from public.formation_charges where studio_id = v_studio;
    delete from public.formation_enrollments where studio_id = v_studio;
    delete from public.formation_sessions where studio_id = v_studio;
    delete from public.formations where studio_id = v_studio;
    delete from public.student_packs where studio_id = v_studio;
    delete from public.payments where studio_id = v_studio;
    delete from public.sessions where studio_id = v_studio;
    delete from public.class_schedules where studio_id = v_studio;
    delete from public.offerings where studio_id = v_studio;
    delete from public.pack_products where studio_id = v_studio;
    delete from public.students where studio_id = v_studio;
    delete from public.studio_members where studio_id = v_studio;
    delete from public.mp_connections where studio_id = v_studio;
    delete from public.studios where id = v_studio;
  end if;

  -- ---------------------------------------------------------------- estudio
  insert into public.studios (slug, name, brand_color, plan, cancel_window_hours)
  values ('demo', 'Tango del Sur', '#7a2e3a', 'estudio', 3)
  returning id into v_studio;

  insert into public.studio_subscriptions (studio_id, status, trial_ends_at)
  values (v_studio, 'trialing', now() + interval '14 days');

  select id into v_owner from auth.users where lower(email) = lower(owner_email);
  if v_owner is not null then
    insert into public.studio_members (studio_id, user_id, role, display_name)
    values (v_studio, v_owner, 'owner', 'Dueña');
  else
    raise notice 'No existe el usuario %: el demo queda sin dueño (entrá una vez a Giroa y volvé a correrlo).', owner_email;
  end if;

  -- ---------------------------------------------------------------- clases y horarios
  insert into public.offerings (studio_id, discipline_key, title, description, level, teacher_name, capacity, role_balance_max_diff)
  values (v_studio, 'tango', 'Tango inicial', 'Abrazo, caminata y primeras figuras. No hace falta venir en pareja.',
          'Principiantes', 'Lucía Ferrari y Martín Gómez', 20, 2)
  returning id into o_inicial;
  insert into public.offerings (studio_id, discipline_key, title, description, level, teacher_name, capacity, role_balance_max_diff)
  values (v_studio, 'tango', 'Tango intermedio', 'Giros, sacadas y musicalidad.', 'Intermedio', 'Carla Ruiz y Diego Paz', 16, 1)
  returning id into o_inter;
  insert into public.offerings (studio_id, discipline_key, title, description, level, teacher_name, capacity, role_balance_max_diff)
  values (v_studio, 'tango', 'Práctica guiada', 'Práctica con música y profes que ayudan en la pista.', 'Todos los niveles',
          'Staff de Tango del Sur', 30, 3)
  returning id into o_practica;
  insert into public.offerings (studio_id, discipline_key, title, description, level, teacher_name, capacity)
  values (v_studio, 'yoga', 'Yoga para bailarines', 'Movilidad, equilibrio y respiración para bailar mejor.', 'Todos los niveles',
          'Sofía Rinaldi', 12)
  returning id into o_yoga;

  insert into public.class_schedules (studio_id, offering_id, weekday, start_time, duration_minutes) values
    (v_studio, o_inicial, 1, '19:00', 90),
    (v_studio, o_inicial, 3, '19:00', 90),
    (v_studio, o_inter, 2, '20:30', 90),
    (v_studio, o_inter, 4, '20:30', 90),
    (v_studio, o_practica, 5, '21:00', 120),
    (v_studio, o_yoga, 6, '10:00', 60);

  -- Sesiones de las últimas 2 semanas y las próximas 3 (en hora local).
  insert into public.sessions (studio_id, offering_id, schedule_id, starts_at, ends_at)
  select cs.studio_id, cs.offering_id, cs.id,
         (d::date + cs.start_time) at time zone v_tz,
         ((d::date + cs.start_time) at time zone v_tz) + make_interval(mins => cs.duration_minutes)
  from public.class_schedules cs
  cross join generate_series((now() at time zone v_tz)::date - 14, (now() at time zone v_tz)::date + 21, interval '1 day') d
  where cs.studio_id = v_studio and extract(dow from d) = cs.weekday
  on conflict (schedule_id, starts_at) do nothing;

  -- ---------------------------------------------------------------- packs
  insert into public.pack_products (studio_id, name, description, credits, validity_days, price_cents, sort)
  values (v_studio, '4 clases', 'Una clase por semana.', 4, 30, 2200000, 1) returning id into p4;
  insert into public.pack_products (studio_id, name, description, credits, validity_days, price_cents, sort)
  values (v_studio, '8 clases', 'El más elegido: dos clases por semana.', 8, 30, 3800000, 2) returning id into p8;
  insert into public.pack_products (studio_id, name, description, credits, validity_days, price_cents, sort)
  values (v_studio, 'Libre mensual', 'Todas las clases y prácticas del mes.', null, 30, 5500000, 3) returning id into plibre;
  insert into public.pack_products (studio_id, name, description, credits, validity_days, price_cents, is_couple, sort)
  values (v_studio, 'Pack pareja 8 clases', 'Para dos: comparten las 8 clases.', 8, 30, 7000000, true, 4) returning id into ppareja;

  -- ---------------------------------------------------------------- alumnos, pagos y saldo
  for i in 1 .. array_length(v_names, 1) loop
    v_role := case when i % 2 = 0 then 'leader'::public.dance_role else 'follower'::public.dance_role end;
    insert into public.students (studio_id, full_name, email, phone, default_role)
    values (
      v_studio, v_names[i],
      lower(translate(split_part(v_names[i], ' ', 1) || '.' || split_part(v_names[i], ' ', 2), 'áéíóúÁÉÍÓÚñ', 'aeiouAEIOUn')) || '@ejemplo.com',
      '11 ' || (4000 + i * 137)::text || '-' || (1000 + i * 71)::text,
      v_role
    )
    returning id into v_student;
    v_students := v_students || v_student;
    v_roles := v_roles || v_role;

    -- 3 alumnos sin pack vigente (para mostrar "Sin saldo"); el resto con pack.
    if i in (7, 15, 22) then
      continue;
    end if;

    v_product := case when i % 5 = 0 then plibre when i % 7 = 0 then p4 else p8 end;
    select price_cents, credits into v_price, v_credits from public.pack_products where id = v_product;
    -- Algunos compraron hace casi un mes (vencen en pocos días).
    -- La mayoría compró antes de las 2 semanas de historia (así el pack cubre esas clases).
    v_days_ago := case when i in (3, 10, 18) then 28 else 15 + (i % 8) end;
    v_paid_at := now() - make_interval(days => v_days_ago, hours => 2);

    insert into public.payments (studio_id, student_id, pack_product_id, amount_cents, method, status, paid_at, created_at)
    values (v_studio, v_student, v_product, v_price,
            case when i % 3 = 0 then 'transfer'::public.payment_method else 'cash'::public.payment_method end,
            'approved', v_paid_at, v_paid_at)
    returning id into v_payment;

    insert into public.student_packs (studio_id, student_id, pack_product_id, payment_id, name, credits_total, starts_at, expires_at)
    select v_studio, v_student, v_product, v_payment, name, v_credits, v_paid_at,
           ((((v_paid_at at time zone v_tz)::date) + 31)::timestamp) at time zone v_tz
    from public.pack_products where id = v_product
    returning id into v_pack;

    insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note, created_at)
    values (v_studio, v_pack, 'grant', coalesce(v_credits, 0), 'Acreditación del pago', v_paid_at);
  end loop;

  -- ---------------------------------------------------------------- asistencia pasada y reservas futuras
  for v_session in
    select s.id, s.starts_at, s.offering_id, o.capacity, o.discipline_key, o.title
    from public.sessions s join public.offerings o on o.id = s.offering_id
    where s.studio_id = v_studio and s.starts_at < now() + interval '7 days'
    -- Primero Tango inicial (la clase "que se llena" del demo).
    order by (o.title = 'Tango inicial') desc, s.starts_at
  loop
    -- Tango inicial se llena (para mostrar "conviene abrir otro horario"); el resto, valores realistas.
    v_target := greatest(4, floor(v_session.capacity *
      case when v_session.title = 'Tango inicial' then 0.85 + random() * 0.15 else 0.5 + random() * 0.3 end)::integer);
    v_taken := 0;
    v_leaders := 0;
    v_followers := 0;
    -- Varias pasadas en orden aleatorio; en tango se respeta la misma regla de
    -- balance que book_session (diferencia máxima 1).
    for i in
      select g from generate_series(1, array_length(v_students, 1)) g, generate_series(1, 3) pass
      order by pass, random()
    loop
      exit when v_taken >= v_target;
      continue when exists (select 1 from public.bookings b where b.session_id = v_session.id and b.student_id = v_students[i]);
      if v_session.discipline_key = 'tango' then
        continue when v_roles[i] = 'leader' and (v_leaders + 1) - v_followers > 1;
        continue when v_roles[i] = 'follower' and (v_followers + 1) - v_leaders > 1;
      end if;

      select sp.id into v_pack
      from public.student_packs sp
      where sp.student_id = v_students[i]
        and sp.starts_at <= v_session.starts_at
        and sp.expires_at > v_session.starts_at
        and (sp.credits_total is null or sp.credits_used < sp.credits_total)
      order by sp.expires_at
      limit 1;
      continue when v_pack is null;

      insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role, status, checked_in_at, created_at)
      values (
        v_studio, v_session.id, v_students[i], v_pack,
        case when v_session.discipline_key = 'tango' then v_roles[i] end,
        case when v_session.starts_at < now() then (case when random() < 0.92 then 'attended' else 'no_show' end)::public.booking_status
             else 'booked'::public.booking_status end,
        case when v_session.starts_at < now() then v_session.starts_at + interval '5 minutes' end,
        v_session.starts_at - interval '1 day'
      )
      on conflict do nothing;

      update public.student_packs set credits_used = credits_used + 1 where id = v_pack;
      insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, created_at)
      values (v_studio, v_pack, 'consume', -1, v_session.starts_at - interval '1 day');
      v_taken := v_taken + 1;
      if v_roles[i] = 'leader' then v_leaders := v_leaders + 1; else v_followers := v_followers + 1; end if;
    end loop;
  end loop;

  -- Arreglo del check: un no_show no tiene checked_in_at.
  update public.bookings set checked_in_at = null where studio_id = v_studio and status = 'no_show';

  -- ---------------------------------------------------------------- formación
  -- Arrancó un sábado hace unas 10 semanas: matrícula + 5 cuotas (vencen el 10 de cada mes),
  -- 9 inscriptos (2 con la última cuota vencida sin pagar), 2 postulaciones por revisar y
  -- asistencia a los encuentros que ya pasaron.
  v_today := (now() at time zone v_tz)::date;
  v_start := (date_trunc('week', v_today - 70)::date + 5);
  v_first_due := make_date(extract(year from v_start)::int, extract(month from v_start)::int, 10);
  select max(d)::date into v_last_due
  from generate_series(v_first_due, v_first_due + interval '4 months', interval '1 month') d where d::date <= v_today;

  insert into public.formations (studio_id, title, description, starts_on, ends_on, capacity, status, enrollment_open,
    requires_approval, enrollment_fee_cents, installments_count, installment_cents, first_due_on, min_attendance_pct)
  values (v_studio, 'Formación de Instructores de Tango',
    'Cinco meses para aprender a enseñar: técnica, pedagogía, musicalidad y práctica con alumnos reales. Sábados de 15 a 18.',
    v_start, v_start + 140, 15, 'published', true, true, 3000000, 5, 4500000, v_first_due, 75)
  returning id into v_f;

  insert into public.formation_sessions (studio_id, formation_id, title, starts_at, ends_at, location, teacher_name)
  select v_studio, v_f, 'Encuentro ' || row_number() over (order by d),
         (d::date + time '15:00') at time zone v_tz, (d::date + time '18:00') at time zone v_tz,
         'Salón principal', 'Lucía Ferrari'
  from generate_series(v_start, v_start + 140, interval '7 days') d;

  for i in 1 .. 11 loop
    if i <= 9 then
      insert into public.formation_enrollments (studio_id, formation_id, student_id, status, applied_at, decided_at, enrolled_at)
      values (v_studio, v_f, v_students[i], 'enrolled', v_start - 21, v_start - 19, v_start - 16)
      returning id into v_enr;
      insert into public.formation_charges (studio_id, enrollment_id, formation_id, kind, amount_cents, due_on, status, method, paid_at)
      values (v_studio, v_enr, v_f, 'enrollment', 3000000, v_start - 16, 'paid', 'mercadopago', v_start - 16);
      for n in 1 .. 5 loop
        v_due := (v_first_due + make_interval(months => n - 1))::date;
        v_debt := v_due > v_today or (i in (4, 7) and v_due = v_last_due);
        insert into public.formation_charges (studio_id, enrollment_id, formation_id, kind, number, amount_cents, due_on, status, method, paid_at)
        values (v_studio, v_enr, v_f, 'installment', n, 4500000, v_due,
          (case when v_debt then 'pending' else 'paid' end)::public.formation_charge_status,
          (case when v_debt then null when i % 3 = 0 then 'cash' else 'mercadopago' end)::public.payment_method,
          case when not v_debt then v_due - 2 end);
      end loop;
      insert into public.formation_attendance (studio_id, formation_session_id, enrollment_id, checked_in_at)
      select v_studio, fs.id, v_enr, fs.starts_at + interval '5 minutes'
      from public.formation_sessions fs
      where fs.formation_id = v_f and fs.starts_at < now() and random() < 0.88;
    else
      insert into public.formation_enrollments (studio_id, formation_id, student_id, status, application_message, applied_at)
      values (v_studio, v_f, v_students[i], 'applied', 'Bailo hace 4 años y me encantaría empezar a enseñar.', now() - interval '2 days');
    end if;
  end loop;

  -- ---------------------------------------------------------------- milonga con entradas
  -- El sábado que viene (al menos dentro de una semana), con 35 entradas vendidas.
  v_party := date_trunc('week', v_today + 7)::date + 5;
  insert into public.events (studio_id, title, description, venue, starts_at, ends_at, status)
  values (v_studio, 'Milonga de Primavera',
    'Música en vivo con el Trío Arrabal, clase de pre-milonga a las 21 y exhibición de los profes.',
    'Salón del Sur · Av. Rivadavia 4321',
    (v_party + time '22:00') at time zone v_tz, (v_party + 1 + time '03:00') at time zone v_tz, 'published')
  returning id into v_e;
  insert into public.event_ticket_types (studio_id, event_id, name, price_cents, quantity, sort)
  values (v_studio, v_e, 'Anticipada', 800000, 80, 1) returning id into v_ant;
  insert into public.event_ticket_types (studio_id, event_id, name, price_cents, quantity, sort)
  values (v_studio, v_e, 'Con clase de pre-milonga', 1200000, 30, 2) returning id into v_pre;

  for i in 1 .. 28 loop
    v_qty := case when i % 4 = 0 then 2 else 1 end;
    v_paid_at := now() - make_interval(days => 1 + i % 9, hours => i % 7);
    insert into public.event_orders (studio_id, event_id, ticket_type_id, quantity, buyer_name, buyer_email,
      unit_price_cents, amount_cents, method, status, paid_at, created_at)
    values (v_studio, v_e, case when i % 3 = 0 then v_pre else v_ant end, v_qty,
      (array['Ana','Pablo','Laura','Diego','Carla','Nico','Vero','Seba','Flor','Mariano','Lu','Gaby','Romi','Fede'])[1 + i % 14] || ' ' ||
      (array['García','López','Martínez','Romero','Sosa','Díaz','Benítez','Acosta','Medina','Herrera'])[1 + i % 10],
      'comprador' || i || '@ejemplo.com',
      case when i % 3 = 0 then 1200000 else 800000 end,
      v_qty * case when i % 3 = 0 then 1200000 else 800000 end,
      (case when i % 5 = 0 then 'cash' else 'mercadopago' end)::public.payment_method, 'paid', v_paid_at, v_paid_at)
    returning id into v_o;
    insert into public.event_tickets (studio_id, order_id, event_id, ticket_type_id, number)
    select v_studio, v_o, v_e, o.ticket_type_id, g
    from public.event_orders o, generate_series(1, v_qty) g where o.id = v_o;
  end loop;

  raise notice 'Formación: % inscriptos, % postulaciones. Milonga: % entradas vendidas.',
    (select count(*) from public.formation_enrollments where formation_id = v_f and status = 'enrolled'),
    (select count(*) from public.formation_enrollments where formation_id = v_f and status = 'applied'),
    (select count(*) from public.event_tickets where event_id = v_e);

  raise notice 'Estudio demo listo: % alumnos, % sesiones, % reservas.',
    (select count(*) from public.students where studio_id = v_studio),
    (select count(*) from public.sessions where studio_id = v_studio),
    (select count(*) from public.bookings where studio_id = v_studio);
end
$demo$;
