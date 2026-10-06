-- =============================================================================
-- Lista de espera (feature 'waitlist', planes Estudio y Pro).
-- Con la clase completa (o sin lugar para su rol), el alumno se anota. Cuando
-- alguien cancela, se les avisa por mail a los que esperan y el primero que
-- reserva se queda el lugar. Al reservar, sale solo de la lista.
-- =============================================================================

create type public.waitlist_status as enum ('waiting', 'booked', 'left');

create table public.session_waitlist (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  session_id uuid not null,
  student_id uuid not null,
  dance_role public.dance_role,
  status public.waitlist_status not null default 'waiting',
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  foreign key (studio_id, session_id) references public.sessions (studio_id, id) on delete cascade,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete cascade
);

create unique index session_waitlist_one_waiting on public.session_waitlist (session_id, student_id)
  where status = 'waiting';
create index session_waitlist_session_idx on public.session_waitlist (session_id, created_at) where status = 'waiting';
create index session_waitlist_student_idx on public.session_waitlist (student_id) where status = 'waiting';

create trigger session_waitlist_updated_at before update on public.session_waitlist
  for each row execute function private.set_updated_at();

alter table public.session_waitlist enable row level security;
revoke all on public.session_waitlist from anon, authenticated;
grant select on public.session_waitlist to authenticated;

create policy session_waitlist_read on public.session_waitlist for select to authenticated
  using (private.is_studio_staff(studio_id) or student_id in (select private.my_student_ids()));

-- -----------------------------------------------------------------------------
-- Lugar disponible en una clase para un rol: 'ok', 'full' o 'role_unbalanced'.
-- (Misma regla que book_session.)
-- -----------------------------------------------------------------------------
create function private.session_spot(p_session_id uuid, p_role public.dance_role)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_taken integer;
  v_leaders integer;
  v_followers integer;
  v_same integer;
  v_other integer;
begin
  select * into v_session from public.sessions where id = p_session_id;
  select * into v_offering from public.offerings where id = v_session.offering_id;

  select
    count(*)::integer,
    count(*) filter (where b.dance_role = 'leader')::integer,
    count(*) filter (where b.dance_role = 'follower')::integer
  into v_taken, v_leaders, v_followers
  from public.bookings b
  where b.session_id = p_session_id and b.status in ('booked', 'attended');

  if v_taken >= coalesce(v_session.capacity_override, v_offering.capacity) then
    return 'full';
  end if;

  if p_role is not null and v_offering.role_balance_max_diff is not null
     and private.discipline_has(v_offering.discipline_key, 'role_balance') then
    v_same := case when p_role = 'leader' then v_leaders else v_followers end;
    v_other := case when p_role = 'leader' then v_followers else v_leaders end;
    if (v_same + 1) - v_other > v_offering.role_balance_max_diff then
      return 'role_unbalanced';
    end if;
  end if;

  return 'ok';
end;
$$;

revoke execute on function private.session_spot(uuid, public.dance_role) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Anotarse / salir de la lista de espera (el alumno, para sí mismo).
-- -----------------------------------------------------------------------------
create function public.join_waitlist(p_session_id uuid, p_role public.dance_role default null)
returns public.session_waitlist
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_offering public.offerings%rowtype;
  v_student public.students%rowtype;
  v_role public.dance_role;
  v_entry public.session_waitlist%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    perform private.fail('No encontramos esa clase.', 'session_not_found');
  end if;
  select * into v_offering from public.offerings where id = v_session.offering_id;

  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión.', 'not_authenticated');
  end if;
  select * into v_student from public.students where studio_id = v_session.studio_id and user_id = v_uid;
  if not found then
    perform private.fail('Todavía no sos alumno/a de este estudio. Sumate para anotarte.', 'not_a_student');
  end if;
  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio. Hablá con el estudio para reactivarla.', 'student_inactive');
  end if;

  if not public.studio_has_feature(v_session.studio_id, 'waitlist') then
    perform private.fail('Este estudio no tiene lista de espera.', 'feature_not_in_plan');
  end if;
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
    where b.session_id = v_session.id and b.student_id = v_student.id and b.status in ('booked', 'attended')
  ) then
    perform private.fail('Ya tenés lugar en esta clase.', 'already_booked');
  end if;

  if private.discipline_has(v_offering.discipline_key, 'role_balance') then
    v_role := coalesce(p_role, v_student.default_role);
    if v_role is null then
      perform private.fail('Elegí si vas como líder o seguidor/a.', 'role_required');
    end if;
  end if;

  if private.session_spot(v_session.id, v_role) = 'ok' then
    perform private.fail('¡Hay lugar! Reservá directamente.', 'has_spots');
  end if;

  select * into v_entry from public.session_waitlist
  where session_id = v_session.id and student_id = v_student.id and status = 'waiting';
  if found then
    return v_entry;
  end if;

  insert into public.session_waitlist (studio_id, session_id, student_id, dance_role)
  values (v_session.studio_id, v_session.id, v_student.id, v_role)
  returning * into v_entry;
  return v_entry;
end;
$$;

create function public.leave_waitlist(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.session_waitlist w set status = 'left'
  where w.session_id = p_session_id and w.status = 'waiting'
    and w.student_id in (select private.my_student_ids());
end;
$$;

-- Mis lugares en listas de espera de clases futuras, con la posición (el
-- alumno no ve a los demás de la lista, solo en qué lugar está).
create function public.my_waitlist(p_studio_id uuid)
returns table (session_id uuid, "position" integer, dance_role public.dance_role)
language sql
stable
security definer
set search_path = ''
as $$
  select w.session_id,
    (select count(*)::integer from public.session_waitlist o
     where o.session_id = w.session_id and o.status = 'waiting' and o.created_at <= w.created_at),
    w.dance_role
  from public.session_waitlist w
  join public.sessions s on s.id = w.session_id
  where w.studio_id = p_studio_id and w.status = 'waiting' and s.starts_at > now()
    and w.student_id in (select private.my_student_ids());
$$;

-- -----------------------------------------------------------------------------
-- Aviso: al cancelarse una reserva de una clase que todavía no empezó, se les
-- manda un mail a los que esperan (una vez por cada lugar que se libera).
-- -----------------------------------------------------------------------------
create function private.notify_waitlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_title text;
  v_entry record;
begin
  select * into v_session from public.sessions where id = new.session_id;
  -- Clase cancelada por el estudio (cancel_session) o que ya está por empezar: no se avisa.
  if v_session.status <> 'scheduled' or v_session.starts_at <= now() + interval '15 minutes' then
    return null;
  end if;
  select o.title into v_title from public.offerings o where o.id = v_session.offering_id;

  for v_entry in
    select w.id, w.student_id from public.session_waitlist w
    where w.session_id = new.session_id and w.status = 'waiting'
    order by w.created_at
    limit 30
  loop
    perform private.enqueue_notification(
      new.studio_id, v_entry.student_id, 'waitlist_spot',
      jsonb_build_object('session_id', v_session.id, 'title', v_title, 'starts_at', v_session.starts_at),
      now(), 'waitlist_spot:' || v_entry.id || ':' || new.id
    );
    update public.session_waitlist set notified_at = now() where id = v_entry.id;
  end loop;

  return null;
end;
$$;

revoke execute on function private.notify_waitlist() from public, anon, authenticated;

create trigger bookings_notify_waitlist
  after update of status on public.bookings
  for each row
  when (old.status = 'booked' and new.status = 'cancelled')
  execute function private.notify_waitlist();

-- Al reservar, sale de la lista de espera de esa clase.
create function private.waitlist_mark_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.session_waitlist set status = 'booked'
  where session_id = new.session_id and student_id = new.student_id and status = 'waiting';
  return null;
end;
$$;

revoke execute on function private.waitlist_mark_booked() from public, anon, authenticated;

create trigger bookings_waitlist_booked
  after insert on public.bookings
  for each row
  when (new.status in ('booked', 'attended'))
  execute function private.waitlist_mark_booked();

grant execute on function public.join_waitlist(uuid, public.dance_role) to authenticated;
grant execute on function public.leave_waitlist(uuid) to authenticated;
grant execute on function public.my_waitlist(uuid) to authenticated;
