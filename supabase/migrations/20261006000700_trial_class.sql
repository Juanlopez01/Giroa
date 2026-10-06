-- =============================================================================
-- Clase de prueba gratis (feature 'trial_class', planes Estudio y Pro).
-- El estudio la activa en Ajustes. Una persona que nunca compró un pack puede
-- reservar UNA clase sin saldo. Si cancela a tiempo (se "devuelve"), la puede
-- volver a usar; si faltó o canceló tarde, ya la usó.
-- =============================================================================

alter table public.studios add column trial_class_enabled boolean not null default false;
grant update (trial_class_enabled) on public.studios to authenticated;

alter table public.bookings add column is_trial boolean not null default false;
alter table public.bookings add constraint bookings_trial_without_pack
  check (not is_trial or student_pack_id is null);

create index bookings_trial_idx on public.bookings (student_id) where is_trial;

/** ¿El alumno puede usar la clase de prueba en este estudio? */
create function private.trial_available(p_studio_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select s.trial_class_enabled from public.studios s where s.id = p_studio_id), false)
    and public.studio_has_feature(p_studio_id, 'trial_class')
    and not exists (
      select 1 from public.student_packs sp
      where sp.studio_id = p_studio_id
        and (sp.student_id = p_student_id or sp.partner_student_id = p_student_id)
    )
    and not exists (
      select 1 from public.bookings b
      where b.studio_id = p_studio_id and b.student_id = p_student_id and b.is_trial
        and (b.status in ('booked', 'attended', 'no_show') or (b.status = 'cancelled' and not b.credit_refunded))
    )
$$;

revoke execute on function private.trial_available(uuid, uuid) from public, anon, authenticated;

/** Para la app: si el alumno logueado tiene disponible la clase de prueba. */
create function public.my_trial_available(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.trial_available(p_studio_id, s.id)
     from public.students s
     where s.studio_id = p_studio_id and s.user_id = auth.uid() and s.is_active),
    false
  )
$$;

-- -----------------------------------------------------------------------------
-- book_session con p_trial: igual que antes, pero la clase de prueba no usa saldo.
-- -----------------------------------------------------------------------------
drop function public.book_session(uuid, public.dance_role, uuid);

create function public.book_session(
  p_session_id uuid,
  p_role public.dance_role default null,
  p_student_id uuid default null,
  p_trial boolean default false
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_student public.students%rowtype;
  v_is_staff boolean;
  v_capacity integer;
  v_taken integer;
  v_leaders integer;
  v_followers integer;
  v_same integer;
  v_other integer;
  v_role public.dance_role;
  v_pack_id uuid;
  v_booking public.bookings%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;

  select * into v_offering from public.offerings where id = v_session.offering_id;
  v_is_staff := private.is_privileged() or private.is_studio_staff(v_session.studio_id);

  -- Quién reserva.
  if p_student_id is not null then
    if not v_is_staff then
      perform private.fail('No podés anotar a otra persona.', 'forbidden');
    end if;
    select * into v_student from public.students
    where id = p_student_id and studio_id = v_session.studio_id;
    if not found then
      perform private.fail('No encontramos a ese alumno en el estudio.', 'student_not_found');
    end if;
  else
    if v_uid is null then
      perform private.fail('Tenés que iniciar sesión para reservar.', 'not_authenticated');
    end if;
    select * into v_student from public.students
    where studio_id = v_session.studio_id and user_id = v_uid;
    if not found then
      perform private.fail('Todavía no sos alumno/a de este estudio. Sumate para reservar.', 'not_a_student');
    end if;
  end if;

  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio. Hablá con el estudio para reactivarla.', 'student_inactive');
  end if;

  -- La clase.
  if v_session.status <> 'scheduled' then
    perform private.fail('Esta clase fue cancelada.', 'session_cancelled');
  end if;
  if v_session.starts_at <= now() then
    perform private.fail('Esta clase ya empezó.', 'session_started');
  end if;
  if not v_offering.is_active or v_offering.kind <> 'regular' then
    perform private.fail('Esta clase no admite reservas.', 'not_bookable');
  end if;

  if exists (
    select 1 from public.bookings b
    where b.session_id = v_session.id and b.student_id = v_student.id
      and b.status in ('booked', 'attended')
  ) then
    perform private.fail('Ya tenés lugar en esta clase.', 'already_booked');
  end if;

  if coalesce(p_trial, false) and not private.trial_available(v_session.studio_id, v_student.id) then
    perform private.fail('La clase de prueba ya no está disponible. Comprá un pack para reservar.', 'trial_not_available');
  end if;

  -- Cupo.
  select
    count(*)::integer,
    count(*) filter (where b.dance_role = 'leader')::integer,
    count(*) filter (where b.dance_role = 'follower')::integer
  into v_taken, v_leaders, v_followers
  from public.bookings b
  where b.session_id = v_session.id and b.status in ('booked', 'attended');

  v_capacity := coalesce(v_session.capacity_override, v_offering.capacity);
  if v_taken >= v_capacity then
    perform private.fail('La clase está completa.', 'session_full');
  end if;

  -- Balance de roles (solo disciplinas con el flag).
  if private.discipline_has(v_offering.discipline_key, 'role_balance') then
    v_role := coalesce(p_role, v_student.default_role);
    if v_role is null then
      perform private.fail('Elegí si vas como líder o seguidor/a.', 'role_required');
    end if;

    if v_offering.role_balance_max_diff is not null then
      v_same := case when v_role = 'leader' then v_leaders else v_followers end;
      v_other := case when v_role = 'leader' then v_followers else v_leaders end;
      if (v_same + 1) - v_other > v_offering.role_balance_max_diff then
        perform private.fail(
          format(
            'Por ahora no hay lugar como %s: faltan %s para mantener el balance de la clase. Probá más tarde.',
            private.role_label(v_role),
            private.role_label(case when v_role = 'leader' then 'follower'::public.dance_role else 'leader'::public.dance_role end, true)
          ),
          'role_unbalanced'
        );
      end if;
    end if;
  else
    v_role := null;
  end if;

  -- Clase de prueba: sin saldo.
  if coalesce(p_trial, false) then
    insert into public.bookings (studio_id, session_id, student_id, dance_role, is_trial, created_by)
    values (v_session.studio_id, v_session.id, v_student.id, v_role, true, v_uid)
    returning * into v_booking;
    return v_booking;
  end if;

  -- Saldo: consume el pack que vence primero.
  v_pack_id := private.take_credit(v_session.studio_id, v_student.id, v_session.starts_at);
  if v_pack_id is null then
    if p_student_id is not null then
      perform private.fail('Este alumno no tiene clases disponibles. Cargale un pack.', 'no_credits');
    else
      perform private.fail('No tenés clases disponibles. Comprá un pack.', 'no_credits');
    end if;
  end if;

  insert into public.bookings (studio_id, session_id, student_id, student_pack_id, dance_role, created_by)
  values (v_session.studio_id, v_session.id, v_student.id, v_pack_id, v_role, v_uid)
  returning * into v_booking;

  insert into public.pack_credit_events (studio_id, student_pack_id, booking_id, kind, delta, created_by)
  values (v_session.studio_id, v_pack_id, v_booking.id, 'consume', -1, v_uid);

  return v_booking;
end;
$$;

grant execute on function public.book_session(uuid, public.dance_role, uuid, boolean) to authenticated, service_role;
grant execute on function public.my_trial_available(uuid) to authenticated;
