-- =============================================================================
-- Formaciones (feature 'formations'): profesorados, programas de varios meses.
-- Plan Estudio: hasta plans.max_active_formations publicadas a la vez; Pro: sin límite.
--
-- Circuito de ingreso (el estudio aprueba, porque muchas veces hay audición):
--   applied (se postuló) → approved (el estudio lo aceptó: paga la matrícula)
--   → enrolled (pagó la matrícula, o era $0: se generan las cuotas).
--   También: rejected, withdrawn.
-- Si la formación no requiere aprobación, la postulación queda aprobada al toque.
--
-- Cobros (formation_charges): matrícula, cuotas o pago total con descuento.
-- Se pagan con link de MP (external_reference "formacion:<uuid>") o en el
-- mostrador. Deuda: si al día 10 del mes de vencimiento la cuota sigue
-- impaga, se bloquea lo de la formación (no las clases regulares).
-- =============================================================================

create type public.formation_status as enum ('draft', 'published', 'archived');
create type public.enrollment_status as enum ('applied', 'approved', 'enrolled', 'rejected', 'withdrawn');
create type public.formation_charge_kind as enum ('enrollment', 'installment', 'full');
create type public.formation_charge_status as enum ('pending', 'paid', 'cancelled');
create type public.assessment_kind as enum ('grade', 'pass_fail');

create table public.formations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 6000),
  starts_on date not null,
  ends_on date not null,
  capacity integer check (capacity between 1 and 10000),
  status public.formation_status not null default 'draft',
  enrollment_open boolean not null default true,
  requires_approval boolean not null default true,
  enrollment_fee_cents bigint not null default 0 check (enrollment_fee_cents >= 0),
  installments_count smallint not null default 0 check (installments_count between 0 and 36),
  installment_cents bigint not null default 0 check (installment_cents >= 0),
  -- Vencimiento de la primera cuota; las siguientes, mismo día de cada mes.
  first_due_on date,
  -- Pago total con descuento (opcional, en vez de las cuotas).
  full_payment_cents bigint check (full_payment_cents > 0),
  min_attendance_pct smallint not null default 80 check (min_attendance_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  check (ends_on >= starts_on),
  check (installments_count = 0 or (installment_cents > 0 and first_due_on is not null))
);

create trigger formations_updated_at before update on public.formations
  for each row execute function private.set_updated_at();

create table public.formation_sessions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  formation_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text check (char_length(location) <= 200),
  online_url text check (online_url ~ '^https://' and char_length(online_url) <= 500),
  teacher_name text check (char_length(teacher_name) <= 120),
  teacher_member_id uuid,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (studio_id, id),
  check (ends_at > starts_at),
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade,
  foreign key (studio_id, teacher_member_id) references public.studio_members (studio_id, id) on delete set null (teacher_member_id)
);

create index formation_sessions_formation_idx on public.formation_sessions (formation_id, starts_at);

create table public.formation_enrollments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  formation_id uuid not null,
  student_id uuid not null,
  status public.enrollment_status not null default 'applied',
  application_message text check (char_length(application_message) <= 2000),
  staff_notes text check (char_length(staff_notes) <= 2000),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  enrolled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  unique (formation_id, student_id),
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete cascade
);

create trigger formation_enrollments_updated_at before update on public.formation_enrollments
  for each row execute function private.set_updated_at();

create table public.formation_charges (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  enrollment_id uuid not null,
  formation_id uuid not null,
  kind public.formation_charge_kind not null,
  number smallint not null default 1,
  amount_cents bigint not null check (amount_cents > 0),
  due_on date not null,
  status public.formation_charge_status not null default 'pending',
  method public.payment_method,
  paid_at timestamptz,
  external_reference uuid not null unique default gen_random_uuid(),
  mp_preference_id text,
  mp_payment_id text unique,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  unique (enrollment_id, kind, number),
  check (status <> 'paid' or (paid_at is not null and method is not null)),
  foreign key (studio_id, enrollment_id) references public.formation_enrollments (studio_id, id) on delete cascade,
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade
);

create index formation_charges_pending_idx on public.formation_charges (due_on) where status = 'pending';
create index formation_charges_paid_idx on public.formation_charges (studio_id, paid_at) where status = 'paid';

create trigger formation_charges_updated_at before update on public.formation_charges
  for each row execute function private.set_updated_at();

create table public.formation_attendance (
  studio_id uuid not null references public.studios (id) on delete cascade,
  formation_session_id uuid not null,
  enrollment_id uuid not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users (id) on delete set null,
  primary key (formation_session_id, enrollment_id),
  foreign key (studio_id, formation_session_id) references public.formation_sessions (studio_id, id) on delete cascade,
  foreign key (studio_id, enrollment_id) references public.formation_enrollments (studio_id, id) on delete cascade
);

create table public.formation_assessments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  formation_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  kind public.assessment_kind not null default 'pass_fail',
  due_on date,
  created_at timestamptz not null default now(),
  unique (studio_id, id),
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade
);

create table public.formation_grades (
  studio_id uuid not null references public.studios (id) on delete cascade,
  assessment_id uuid not null,
  enrollment_id uuid not null,
  grade numeric(4, 2) check (grade between 0 and 10),
  passed boolean,
  feedback text check (char_length(feedback) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (assessment_id, enrollment_id),
  foreign key (studio_id, assessment_id) references public.formation_assessments (studio_id, id) on delete cascade,
  foreign key (studio_id, enrollment_id) references public.formation_enrollments (studio_id, id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.formations enable row level security;
alter table public.formation_sessions enable row level security;
alter table public.formation_enrollments enable row level security;
alter table public.formation_charges enable row level security;
alter table public.formation_attendance enable row level security;
alter table public.formation_assessments enable row level security;
alter table public.formation_grades enable row level security;

revoke all on public.formations, public.formation_sessions, public.formation_enrollments, public.formation_charges,
  public.formation_attendance, public.formation_assessments, public.formation_grades from anon, authenticated;

grant select on public.formations, public.formation_sessions to anon, authenticated;
grant insert, update, delete on public.formations, public.formation_sessions, public.formation_assessments to authenticated;
grant select on public.formation_enrollments, public.formation_charges, public.formation_attendance,
  public.formation_assessments, public.formation_grades to authenticated;
-- Notas internas del staff: el alumno no las ve (se leen por columna).
revoke select on public.formation_enrollments from authenticated;
grant select (id, studio_id, formation_id, student_id, status, application_message, applied_at, decided_at, enrolled_at, created_at, updated_at)
  on public.formation_enrollments to authenticated;

create policy formations_read on public.formations for select to anon, authenticated
  using (status = 'published' or private.is_studio_staff(studio_id));
create policy formations_admin_insert on public.formations for insert to authenticated
  with check (private.is_studio_admin(studio_id) and public.studio_has_feature(studio_id, 'formations'));
create policy formations_admin_update on public.formations for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy formations_admin_delete on public.formations for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy formation_sessions_read on public.formation_sessions for select to anon, authenticated
  using (private.is_studio_staff(studio_id)
    or exists (select 1 from public.formations f where f.id = formation_id and f.status = 'published'));
create policy formation_sessions_admin_write on public.formation_sessions for all to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));

create policy formation_enrollments_read on public.formation_enrollments for select to authenticated
  using (private.is_studio_staff(studio_id) or student_id in (select private.my_student_ids()));
create policy formation_charges_read on public.formation_charges for select to authenticated
  using (private.is_studio_staff(studio_id)
    or enrollment_id in (select e.id from public.formation_enrollments e where e.student_id in (select private.my_student_ids())));
create policy formation_attendance_read on public.formation_attendance for select to authenticated
  using (private.is_studio_staff(studio_id)
    or enrollment_id in (select e.id from public.formation_enrollments e where e.student_id in (select private.my_student_ids())));
create policy formation_assessments_read on public.formation_assessments for select to authenticated
  using (private.is_studio_staff(studio_id)
    or formation_id in (select e.formation_id from public.formation_enrollments e
                        where e.student_id in (select private.my_student_ids()) and e.status = 'enrolled'));
create policy formation_assessments_admin_write on public.formation_assessments for all to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy formation_grades_read on public.formation_grades for select to authenticated
  using (private.is_studio_staff(studio_id)
    or enrollment_id in (select e.id from public.formation_enrollments e where e.student_id in (select private.my_student_ids())));

-- -----------------------------------------------------------------------------
-- Límite de formaciones publicadas por plan.
-- -----------------------------------------------------------------------------
create function private.check_formation_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_active integer;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  select p.max_active_formations into v_max
  from public.studios s join public.plans p on p.key = s.plan where s.id = new.studio_id;
  if v_max is null then
    return new;
  end if;
  select count(*)::integer into v_active from public.formations
  where studio_id = new.studio_id and status = 'published' and id <> new.id;
  if v_active >= v_max then
    perform private.fail(
      format('Tu plan permite hasta %s formaciones publicadas a la vez. Archivá una o pasate a Pro.', v_max),
      'formation_limit'
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.check_formation_limit() from public, anon, authenticated;

create trigger formations_limit before insert or update of status on public.formations
  for each row execute function private.check_formation_limit();

-- -----------------------------------------------------------------------------
-- Cuotas: al quedar inscripto, se generan (idempotente).
-- -----------------------------------------------------------------------------
create function private.formation_create_installments(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
  v_f public.formations%rowtype;
begin
  select * into v_e from public.formation_enrollments where id = p_enrollment_id;
  select * into v_f from public.formations where id = v_e.formation_id;
  if v_f.installments_count = 0 then
    return;
  end if;
  insert into public.formation_charges (studio_id, enrollment_id, formation_id, kind, number, amount_cents, due_on)
  select v_f.studio_id, v_e.id, v_f.id, 'installment', n, v_f.installment_cents,
         (v_f.first_due_on + make_interval(months => n - 1))::date
  from generate_series(1, v_f.installments_count) as n
  on conflict (enrollment_id, kind, number) do nothing;
end;
$$;

revoke execute on function private.formation_create_installments(uuid) from public, anon, authenticated;

/** Pasa a inscripto (al pagar la matrícula o si era $0). */
create function private.formation_enroll(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
begin
  update public.formation_enrollments set status = 'enrolled', enrolled_at = now()
  where id = p_enrollment_id and status = 'approved'
  returning * into v_e;
  if found then
    perform private.formation_create_installments(v_e.id);
    perform private.enqueue_notification(
      v_e.studio_id, v_e.student_id, 'formation_enrolled',
      jsonb_build_object('enrollment_id', v_e.id, 'formation_id', v_e.formation_id), now(),
      'formation_enrolled:' || v_e.id
    );
  end if;
end;
$$;

revoke execute on function private.formation_enroll(uuid) from public, anon, authenticated;

/** Aprueba: crea el cobro de la matrícula o inscribe directo si es $0. */
create function private.formation_approve(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
  v_f public.formations%rowtype;
begin
  update public.formation_enrollments set status = 'approved', decided_at = now(), decided_by = auth.uid()
  where id = p_enrollment_id and status = 'applied'
  returning * into v_e;
  if not found then
    return;
  end if;
  select * into v_f from public.formations where id = v_e.formation_id;

  if v_f.enrollment_fee_cents > 0 then
    insert into public.formation_charges (studio_id, enrollment_id, formation_id, kind, number, amount_cents, due_on)
    values (v_f.studio_id, v_e.id, v_f.id, 'enrollment', 1, v_f.enrollment_fee_cents, current_date + 7)
    on conflict (enrollment_id, kind, number) do nothing;
    perform private.enqueue_notification(
      v_e.studio_id, v_e.student_id, 'formation_approved',
      jsonb_build_object('enrollment_id', v_e.id, 'formation_id', v_f.id), now(), 'formation_approved:' || v_e.id
    );
  else
    perform private.formation_enroll(v_e.id);
  end if;
end;
$$;

revoke execute on function private.formation_approve(uuid) from public, anon, authenticated;

/** Marca un cobro pago y avanza el circuito. Idempotente. */
create function private.formation_charge_paid(p_charge_id uuid, p_method public.payment_method, p_mp_payment_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.formation_charges%rowtype;
begin
  update public.formation_charges set status = 'paid', paid_at = now(), method = p_method,
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id)
  where id = p_charge_id and status = 'pending'
  returning * into v_c;
  if not found then
    return;
  end if;
  if v_c.kind = 'enrollment' then
    perform private.formation_enroll(v_c.enrollment_id);
  elsif v_c.kind = 'full' then
    -- Pagó el total: las cuotas pendientes quedan sin efecto.
    update public.formation_charges set status = 'cancelled', notes = 'Reemplazada por el pago total.'
    where enrollment_id = v_c.enrollment_id and kind = 'installment' and status = 'pending';
  end if;
end;
$$;

revoke execute on function private.formation_charge_paid(uuid, public.payment_method, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Deuda: cuota impaga al día 10 del mes en que vencía (o después).
-- -----------------------------------------------------------------------------
create function private.enrollment_in_debt(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.formation_charges c
    join public.studios s on s.id = c.studio_id
    where c.enrollment_id = p_enrollment_id and c.kind = 'installment' and c.status = 'pending'
      and (now() at time zone s.timezone)::date >= (date_trunc('month', c.due_on) + interval '9 days')::date
  )
$$;

revoke execute on function private.enrollment_in_debt(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC del alumno
-- -----------------------------------------------------------------------------
create function public.apply_to_formation(p_formation_id uuid, p_message text default null)
returns public.formation_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.formations%rowtype;
  v_student public.students%rowtype;
  v_e public.formation_enrollments%rowtype;
begin
  select * into v_f from public.formations where id = p_formation_id for update;
  if not found or v_f.status <> 'published' then
    perform private.fail('Esta formación no está disponible.', 'formation_not_found');
  end if;
  if not v_f.enrollment_open then
    perform private.fail('La inscripción a esta formación está cerrada.', 'enrollment_closed');
  end if;
  if not public.studio_has_feature(v_f.studio_id, 'formations') then
    perform private.fail('Esta formación no está disponible.', 'formation_not_found');
  end if;
  if auth.uid() is null then
    perform private.fail('Tenés que iniciar sesión para postularte.', 'not_authenticated');
  end if;
  select * into v_student from public.students where studio_id = v_f.studio_id and user_id = auth.uid();
  if not found then
    perform private.fail('Primero sumate al estudio.', 'not_a_student');
  end if;

  select * into v_e from public.formation_enrollments where formation_id = v_f.id and student_id = v_student.id;
  if found then
    if v_e.status in ('withdrawn', 'rejected') then
      perform private.fail('Ya te postulaste a esta formación. Hablá con el estudio.', 'already_applied');
    end if;
    return v_e;
  end if;

  if v_f.capacity is not null and (
    select count(*) from public.formation_enrollments e
    where e.formation_id = v_f.id and e.status in ('approved', 'enrolled')
  ) >= v_f.capacity then
    perform private.fail('Se completó el cupo de esta formación.', 'formation_full');
  end if;

  insert into public.formation_enrollments (studio_id, formation_id, student_id, application_message)
  values (v_f.studio_id, v_f.id, v_student.id, nullif(btrim(coalesce(p_message, '')), ''))
  returning * into v_e;

  if not v_f.requires_approval then
    perform private.formation_approve(v_e.id);
    select * into v_e from public.formation_enrollments where id = v_e.id;
  end if;
  return v_e;
end;
$$;

/** Elegir pagar el total con descuento (antes de pagar cualquier cuota). */
create function public.choose_full_payment(p_enrollment_id uuid)
returns public.formation_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
  v_f public.formations%rowtype;
  v_c public.formation_charges%rowtype;
begin
  select * into v_e from public.formation_enrollments where id = p_enrollment_id for update;
  if not found or v_e.student_id not in (select private.my_student_ids()) then
    perform private.fail('No encontramos esa inscripción.', 'enrollment_not_found');
  end if;
  if v_e.status <> 'enrolled' then
    perform private.fail('Primero tenés que estar inscripto.', 'not_enrolled');
  end if;
  select * into v_f from public.formations where id = v_e.formation_id;
  if v_f.full_payment_cents is null then
    perform private.fail('Esta formación no tiene pago total.', 'no_full_payment');
  end if;
  if exists (select 1 from public.formation_charges where enrollment_id = v_e.id and kind = 'installment' and status = 'paid') then
    perform private.fail('Ya pagaste cuotas: el pago total ya no está disponible.', 'installments_started');
  end if;

  select * into v_c from public.formation_charges where enrollment_id = v_e.id and kind = 'full' and status = 'pending';
  if found then
    return v_c;
  end if;
  insert into public.formation_charges (studio_id, enrollment_id, formation_id, kind, number, amount_cents, due_on)
  values (v_e.studio_id, v_e.id, v_f.id, 'full', 1, v_f.full_payment_cents, current_date)
  on conflict (enrollment_id, kind, number) do update set status = 'pending', due_on = current_date
  returning * into v_c;
  return v_c;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC del staff
-- -----------------------------------------------------------------------------
create function public.decide_enrollment(p_enrollment_id uuid, p_approve boolean, p_notes text default null)
returns public.formation_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
  v_f public.formations%rowtype;
begin
  select * into v_e from public.formation_enrollments where id = p_enrollment_id for update;
  if not found or not private.is_studio_admin(v_e.studio_id) then
    perform private.fail('No encontramos esa postulación.', 'enrollment_not_found');
  end if;
  if v_e.status <> 'applied' then
    perform private.fail('Esta postulación ya tiene una decisión.', 'already_decided');
  end if;
  select * into v_f from public.formations where id = v_e.formation_id for update;

  if p_approve then
    if v_f.capacity is not null and (
      select count(*) from public.formation_enrollments e
      where e.formation_id = v_f.id and e.status in ('approved', 'enrolled')
    ) >= v_f.capacity then
      perform private.fail('Ya completaste el cupo de la formación.', 'formation_full');
    end if;
    perform private.formation_approve(v_e.id);
  else
    update public.formation_enrollments set status = 'rejected', decided_at = now(), decided_by = auth.uid()
    where id = v_e.id;
    perform private.enqueue_notification(
      v_e.studio_id, v_e.student_id, 'formation_rejected',
      jsonb_build_object('enrollment_id', v_e.id, 'formation_id', v_f.id), now(), 'formation_rejected:' || v_e.id
    );
  end if;

  if nullif(btrim(coalesce(p_notes, '')), '') is not null then
    update public.formation_enrollments set staff_notes = concat_ws(E'\n', staff_notes, btrim(p_notes)) where id = v_e.id;
  end if;
  select * into v_e from public.formation_enrollments where id = v_e.id;
  return v_e;
end;
$$;

create function public.withdraw_enrollment(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
begin
  select * into v_e from public.formation_enrollments where id = p_enrollment_id for update;
  if not found or not private.is_studio_admin(v_e.studio_id) then
    perform private.fail('No encontramos esa inscripción.', 'enrollment_not_found');
  end if;
  update public.formation_enrollments set status = 'withdrawn' where id = v_e.id;
  update public.formation_charges set status = 'cancelled', notes = 'Baja de la formación.'
  where enrollment_id = v_e.id and status = 'pending';
end;
$$;

/** Pago en el mostrador de una matrícula o cuota. */
create function public.record_formation_payment(p_charge_id uuid, p_method public.payment_method)
returns public.formation_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.formation_charges%rowtype;
begin
  select * into v_c from public.formation_charges where id = p_charge_id for update;
  if not found or not (private.is_privileged() or private.is_studio_staff(v_c.studio_id)) then
    perform private.fail('No encontramos ese cobro.', 'charge_not_found');
  end if;
  if not private.can_take_payments(v_c.studio_id) then
    perform private.fail('No tenés permiso para registrar pagos. Pedíselo al dueño del estudio.', 'cannot_take_payments');
  end if;
  if p_method is null or p_method = 'mercadopago' then
    perform private.fail('Elegí efectivo o transferencia.', 'invalid_method');
  end if;
  if v_c.status <> 'pending' then
    perform private.fail('Este cobro ya no está pendiente.', 'charge_not_pending');
  end if;
  perform private.formation_charge_paid(v_c.id, p_method);
  select * into v_c from public.formation_charges where id = v_c.id;
  return v_c;
end;
$$;

/** Asistencia a un encuentro (manual o con el QR del alumno). Bloquea si debe. */
create function public.formation_check_in(p_session_id uuid, p_enrollment_id uuid default null, p_qr_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.formation_sessions%rowtype;
  v_e public.formation_enrollments%rowtype;
  v_name text;
begin
  select * into v_s from public.formation_sessions where id = p_session_id;
  if not found or not (private.is_privileged() or private.is_studio_staff(v_s.studio_id)) then
    perform private.fail('No encontramos ese encuentro.', 'session_not_found');
  end if;

  if p_enrollment_id is not null then
    select * into v_e from public.formation_enrollments where id = p_enrollment_id and formation_id = v_s.formation_id;
  else
    select e.* into v_e from public.formation_enrollments e
    join public.students st on st.id = e.student_id
    where e.formation_id = v_s.formation_id and st.qr_token = btrim(coalesce(p_qr_token, ''));
  end if;
  if v_e.id is null then
    perform private.fail('No está inscripto en esta formación.', 'not_enrolled');
  end if;
  if v_e.status <> 'enrolled' then
    perform private.fail('No está inscripto en esta formación.', 'not_enrolled');
  end if;
  select full_name into v_name from public.students where id = v_e.student_id;
  if private.enrollment_in_debt(v_e.id) then
    perform private.fail(format('%s tiene una cuota vencida. Registrá el pago para darle el presente.', v_name), 'in_debt');
  end if;

  insert into public.formation_attendance (studio_id, formation_session_id, enrollment_id, checked_in_by)
  values (v_s.studio_id, v_s.id, v_e.id, auth.uid())
  on conflict (formation_session_id, enrollment_id) do nothing;

  return jsonb_build_object('enrollment_id', v_e.id, 'student_name', v_name);
end;
$$;

create function public.formation_set_grade(p_assessment_id uuid, p_enrollment_id uuid, p_grade numeric, p_passed boolean, p_feedback text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.formation_assessments%rowtype;
begin
  select * into v_a from public.formation_assessments where id = p_assessment_id;
  if not found or not (private.is_privileged() or private.is_studio_staff(v_a.studio_id)) then
    perform private.fail('No encontramos esa evaluación.', 'assessment_not_found');
  end if;
  if not exists (select 1 from public.formation_enrollments where id = p_enrollment_id and formation_id = v_a.formation_id) then
    perform private.fail('No está inscripto en esta formación.', 'not_enrolled');
  end if;
  insert into public.formation_grades (studio_id, assessment_id, enrollment_id, grade, passed, feedback, updated_by)
  values (v_a.studio_id, v_a.id, p_enrollment_id,
          case when v_a.kind = 'grade' then p_grade end,
          case when v_a.kind = 'pass_fail' then p_passed else p_grade >= 6 end,
          nullif(btrim(coalesce(p_feedback, '')), ''), auth.uid())
  on conflict (assessment_id, enrollment_id) do update set
    grade = excluded.grade, passed = excluded.passed, feedback = excluded.feedback, updated_at = now(), updated_by = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- Resumen para el alumno (y el staff): asistencia y deuda.
-- -----------------------------------------------------------------------------
create function public.enrollment_progress(p_enrollment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attended', (select count(*) from public.formation_attendance a where a.enrollment_id = e.id),
    'held', (select count(*) from public.formation_sessions s where s.formation_id = e.formation_id and s.starts_at <= now()),
    'total', (select count(*) from public.formation_sessions s where s.formation_id = e.formation_id),
    'min_attendance_pct', f.min_attendance_pct,
    'in_debt', private.enrollment_in_debt(e.id)
  )
  from public.formation_enrollments e
  join public.formations f on f.id = e.formation_id
  where e.id = p_enrollment_id
    and (private.is_studio_staff(e.studio_id) or e.student_id in (select private.my_student_ids()))
$$;

-- -----------------------------------------------------------------------------
-- Webhook de MP. Solo service role. Idempotente.
-- -----------------------------------------------------------------------------
create function public.mp_apply_formation_payment(
  p_external_reference uuid,
  p_mp_payment_id text,
  p_mp_status text,
  p_amount_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.formation_charges%rowtype;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;
  select * into v_c from public.formation_charges where external_reference = p_external_reference for update;
  if not found then
    perform private.fail('No encontramos ese cobro.', 'charge_not_found');
  end if;
  if p_mp_status = 'approved' then
    if v_c.status = 'paid' then
      return jsonb_build_object('charge_id', v_c.id, 'status', 'paid', 'ignored', 'already_paid');
    end if;
    if p_amount_cents is distinct from v_c.amount_cents then
      update public.formation_charges set notes = concat_ws(E'\n', notes,
        format('MP %s aprobado por %s centavos (esperado %s): revisar.', p_mp_payment_id, p_amount_cents, v_c.amount_cents))
      where id = v_c.id;
      return jsonb_build_object('charge_id', v_c.id, 'status', v_c.status, 'ignored', 'amount_mismatch');
    end if;
    perform private.formation_charge_paid(v_c.id, 'mercadopago', p_mp_payment_id);
    return jsonb_build_object('charge_id', v_c.id, 'status', 'paid');
  end if;
  if p_mp_status in ('refunded', 'charged_back') and v_c.status = 'paid' then
    update public.formation_charges set status = 'pending', paid_at = null, method = null,
      notes = concat_ws(E'\n', notes, 'Pago reintegrado: vuelve a quedar pendiente.')
    where id = v_c.id;
  end if;
  return jsonb_build_object('charge_id', v_c.id, 'status', v_c.status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Recordatorios (cron diario): cuota por vencer (3 días) y vencida al día 10.
-- -----------------------------------------------------------------------------
create function private.enqueue_formation_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select c.id, c.studio_id, c.due_on, c.amount_cents, c.number, e.student_id, e.id as enrollment_id, f.title,
      (now() at time zone s.timezone)::date as today
    from public.formation_charges c
    join public.formation_enrollments e on e.id = c.enrollment_id and e.status = 'enrolled'
    join public.formations f on f.id = c.formation_id
    join public.studios s on s.id = c.studio_id
    where c.status = 'pending' and c.kind = 'installment'
  loop
    if v_row.due_on - v_row.today = 3 then
      perform private.enqueue_notification(v_row.studio_id, v_row.student_id, 'formation_due',
        jsonb_build_object('charge_id', v_row.id, 'title', v_row.title, 'number', v_row.number,
                           'amount_cents', v_row.amount_cents, 'due_on', v_row.due_on),
        now(), 'formation_due:' || v_row.id);
      v_count := v_count + 1;
    elsif v_row.today = (date_trunc('month', v_row.due_on) + interval '9 days')::date then
      perform private.enqueue_notification(v_row.studio_id, v_row.student_id, 'formation_overdue',
        jsonb_build_object('charge_id', v_row.id, 'title', v_row.title, 'number', v_row.number,
                           'amount_cents', v_row.amount_cents, 'due_on', v_row.due_on),
        now(), 'formation_overdue:' || v_row.id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.enqueue_formation_reminders() from public, anon, authenticated;

grant execute on function public.apply_to_formation(uuid, text) to authenticated;
grant execute on function public.choose_full_payment(uuid) to authenticated;
grant execute on function public.decide_enrollment(uuid, boolean, text) to authenticated;
grant execute on function public.withdraw_enrollment(uuid) to authenticated;
grant execute on function public.record_formation_payment(uuid, public.payment_method) to authenticated, service_role;
grant execute on function public.formation_check_in(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.formation_set_grade(uuid, uuid, numeric, boolean, text) to authenticated;
grant execute on function public.enrollment_progress(uuid) to authenticated;
grant execute on function public.mp_apply_formation_payment(uuid, text, text, bigint) to service_role;

-- Recordatorios todos los días a las 10:00 ART.
select cron.schedule('giroa_formation_reminders', '0 13 * * *', $$select private.enqueue_formation_reminders()$$);
