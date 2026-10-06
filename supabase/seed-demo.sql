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
  v_target integer;
  v_role public.dance_role;
  v_paid_at timestamptz;
begin
  perform setseed(0.42);

  -- ---------------------------------------------------------------- limpiar demo anterior
  select id into v_studio from public.studios where slug = 'demo';
  if v_studio is not null then
    delete from public.pack_credit_events where studio_id = v_studio;
    delete from public.bookings where studio_id = v_studio;
    delete from public.notifications where studio_id = v_studio;
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

    v_product := case when i % 6 = 0 then plibre when i % 4 = 0 then p4 else p8 end;
    select price_cents, credits into v_price, v_credits from public.pack_products where id = v_product;
    -- Algunos compraron hace casi un mes (vencen en pocos días).
    v_days_ago := case when i in (3, 10, 18) then 28 else (i * 3) % 20 end;
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
    select s.id, s.starts_at, s.offering_id, o.capacity, o.discipline_key
    from public.sessions s join public.offerings o on o.id = s.offering_id
    where s.studio_id = v_studio and s.starts_at < now() + interval '7 days'
    order by s.starts_at
  loop
    -- Ocupación entre 55% y 90% (yoga más chica), balanceada por rol.
    v_target := greatest(4, floor(v_session.capacity * (0.55 + random() * 0.35))::integer);
    v_taken := 0;
    for i in select g from generate_series(1, array_length(v_students, 1)) g order by random() loop
      exit when v_taken >= v_target;
      -- Alterna roles para que la clase quede balanceada.
      if v_session.discipline_key = 'tango' and v_roles[i] <> (case when v_taken % 2 = 0 then 'leader' else 'follower' end)::public.dance_role then
        continue;
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
    end loop;
  end loop;

  -- Arreglo del check: un no_show no tiene checked_in_at.
  update public.bookings set checked_in_at = null where studio_id = v_studio and status = 'no_show';

  raise notice 'Estudio demo listo: % alumnos, % sesiones, % reservas.',
    (select count(*) from public.students where studio_id = v_studio),
    (select count(*) from public.sessions where studio_id = v_studio),
    (select count(*) from public.bookings where studio_id = v_studio);
end
$demo$;
