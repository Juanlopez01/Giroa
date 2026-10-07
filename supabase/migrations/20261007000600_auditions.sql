-- =============================================================================
-- Audiciones básicas (feature 'auditions', planes Estudio y Pro).
-- Una audición es la puerta de entrada a una formación con aprobación:
-- convocatoria pública, formulario armable, link a video, turnos y arancel
-- opcional (MP con external_reference "audicion:<uuid>"). El estudio pone el
-- resultado: admitido (pasa a "aprobado" en la formación → matrícula), lista
-- de espera o no admitido.
--
-- Estados de la inscripción:
--   pending_payment (turno reservado 20 min mientras paga el arancel)
--   submitted (inscripto a la audición) → admitted | waitlisted | rejected
--   cancelled
-- =============================================================================

create type public.audition_status as enum ('draft', 'open', 'closed');
create type public.audition_field_kind as enum ('short_text', 'long_text', 'choice', 'yes_no');
create type public.audition_application_status as enum ('pending_payment', 'submitted', 'admitted', 'waitlisted', 'rejected', 'cancelled');

create table public.auditions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  formation_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 6000),
  closes_at timestamptz,
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  video_mode text not null default 'optional' check (video_mode in ('none', 'optional', 'required')),
  uses_slots boolean not null default false,
  status public.audition_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade
);

create unique index auditions_one_open_per_formation on public.auditions (formation_id) where status = 'open';

create trigger auditions_updated_at before update on public.auditions
  for each row execute function private.set_updated_at();

create table public.audition_fields (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  audition_id uuid not null,
  label text not null check (char_length(btrim(label)) between 2 and 200),
  kind public.audition_field_kind not null default 'short_text',
  options text[] not null default '{}',
  required boolean not null default false,
  sort smallint not null default 100,
  unique (studio_id, id),
  check (kind <> 'choice' or cardinality(options) between 2 and 12),
  foreign key (studio_id, audition_id) references public.auditions (studio_id, id) on delete cascade
);

create table public.audition_slots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  audition_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity smallint not null default 1 check (capacity between 1 and 100),
  unique (studio_id, id),
  unique (audition_id, starts_at),
  check (ends_at > starts_at),
  foreign key (studio_id, audition_id) references public.auditions (studio_id, id) on delete cascade
);

create table public.audition_applications (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  audition_id uuid not null,
  formation_id uuid not null,
  student_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  video_url text check (video_url ~ '^https://' and char_length(video_url) <= 500),
  slot_id uuid,
  status public.audition_application_status not null default 'submitted',
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  hold_expires_at timestamptz,
  method public.payment_method,
  paid_at timestamptz,
  external_reference uuid not null unique default gen_random_uuid(),
  mp_preference_id text,
  mp_payment_id text unique,
  staff_notes text check (char_length(staff_notes) <= 2000),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  unique (audition_id, student_id),
  foreign key (studio_id, audition_id) references public.auditions (studio_id, id) on delete cascade,
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete cascade,
  foreign key (studio_id, slot_id) references public.audition_slots (studio_id, id) on delete set null (slot_id)
);

create index audition_applications_slot_idx on public.audition_applications (slot_id) where slot_id is not null;

create trigger audition_applications_updated_at before update on public.audition_applications
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.auditions enable row level security;
alter table public.audition_fields enable row level security;
alter table public.audition_slots enable row level security;
alter table public.audition_applications enable row level security;

revoke all on public.auditions, public.audition_fields, public.audition_slots, public.audition_applications
  from anon, authenticated;

grant select on public.auditions, public.audition_fields, public.audition_slots to anon, authenticated;
grant insert, update, delete on public.auditions, public.audition_fields, public.audition_slots to authenticated;
-- Sin las notas internas (staff_notes): las lee el panel con service role.
grant select (id, studio_id, audition_id, formation_id, student_id, answers, video_url, slot_id, status, fee_cents,
  hold_expires_at, method, paid_at, decided_at, created_at, updated_at)
  on public.audition_applications to authenticated;

create policy auditions_read on public.auditions for select to anon, authenticated
  using (status <> 'draft' or private.is_studio_staff(studio_id));
create policy auditions_admin_insert on public.auditions for insert to authenticated
  with check (private.is_studio_admin(studio_id) and public.studio_has_feature(studio_id, 'auditions'));
create policy auditions_admin_update on public.auditions for update to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));
create policy auditions_admin_delete on public.auditions for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy audition_fields_read on public.audition_fields for select to anon, authenticated
  using (private.is_studio_staff(studio_id)
    or exists (select 1 from public.auditions a where a.id = audition_id and a.status <> 'draft'));
create policy audition_fields_admin_write on public.audition_fields for all to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));

create policy audition_slots_read on public.audition_slots for select to anon, authenticated
  using (private.is_studio_staff(studio_id)
    or exists (select 1 from public.auditions a where a.id = audition_id and a.status <> 'draft'));
create policy audition_slots_admin_write on public.audition_slots for all to authenticated
  using (private.is_studio_admin(studio_id)) with check (private.is_studio_admin(studio_id));

create policy audition_applications_read on public.audition_applications for select to authenticated
  using (private.is_studio_staff(studio_id) or student_id in (select private.my_student_ids()));

-- -----------------------------------------------------------------------------
-- Turnos
-- -----------------------------------------------------------------------------

/** Lugares ocupados de un turno: todo menos cancelados y reservas vencidas sin pagar. */
create function private.audition_slot_taken(p_slot_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.audition_applications
  where slot_id = p_slot_id
    and status <> 'cancelled'
    and (status <> 'pending_payment' or hold_expires_at > now())
$$;

revoke execute on function private.audition_slot_taken(uuid) from public, anon, authenticated;

create function public.audition_slot_availability(p_audition_id uuid)
returns table (slot_id uuid, starts_at timestamptz, ends_at timestamptz, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.starts_at, s.ends_at, greatest(s.capacity - private.audition_slot_taken(s.id), 0)
  from public.audition_slots s
  join public.auditions a on a.id = s.audition_id
  where s.audition_id = p_audition_id
    and (a.status <> 'draft' or private.is_studio_staff(a.studio_id))
  order by s.starts_at
$$;

-- -----------------------------------------------------------------------------
-- Inscripción a la audición
-- -----------------------------------------------------------------------------
create function private.audition_submitted(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.audition_applications%rowtype;
begin
  select * into v_app from public.audition_applications where id = p_application_id;
  perform private.enqueue_notification(
    v_app.studio_id, v_app.student_id, 'audition_submitted',
    jsonb_build_object('application_id', v_app.id), now(), 'audition_submitted:' || v_app.id
  );
end;
$$;

revoke execute on function private.audition_submitted(uuid) from public, anon, authenticated;

create function public.apply_to_audition(
  p_audition_id uuid,
  p_answers jsonb,
  p_video_url text default null,
  p_slot_id uuid default null
)
returns public.audition_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.auditions%rowtype;
  v_student public.students%rowtype;
  v_app public.audition_applications%rowtype;
  v_field record;
  v_value text;
  v_answers jsonb := '{}'::jsonb;
  v_video text := nullif(btrim(coalesce(p_video_url, '')), '');
  v_slot public.audition_slots%rowtype;
  v_max_len integer;
  v_held integer := 0;
begin
  select * into v_a from public.auditions where id = p_audition_id;
  if not found or v_a.status <> 'open' or not public.studio_has_feature(v_a.studio_id, 'auditions') then
    perform private.fail('Esta audición no está abierta.', 'audition_not_open');
  end if;
  if v_a.closes_at is not null and v_a.closes_at <= now() then
    perform private.fail('Ya cerró la inscripción a esta audición.', 'audition_closed');
  end if;
  if auth.uid() is null then
    perform private.fail('Tenés que iniciar sesión para inscribirte.', 'not_authenticated');
  end if;
  select * into v_student from public.students where studio_id = v_a.studio_id and user_id = auth.uid();
  if not found then
    perform private.fail('Primero sumate al estudio.', 'not_a_student');
  end if;

  select * into v_app from public.audition_applications where audition_id = v_a.id and student_id = v_student.id for update;
  if found and not (v_app.status = 'pending_payment' or v_app.status = 'cancelled') then
    perform private.fail('Ya estás inscripto/a a esta audición.', 'already_applied');
  end if;

  -- Respuestas: solo las del formulario, validadas.
  for v_field in select * from public.audition_fields where audition_id = v_a.id order by sort, id loop
    v_value := nullif(btrim(coalesce(p_answers ->> v_field.id::text, '')), '');
    if v_value is null then
      if v_field.required then
        perform private.fail(format('Completá "%s".', v_field.label), 'missing_answer');
      end if;
      continue;
    end if;
    v_max_len := 300;
    if v_field.kind = 'long_text' then
      v_max_len := 3000;
    end if;
    if char_length(v_value) > v_max_len then
      perform private.fail(format('La respuesta a "%s" es muy larga.', v_field.label), 'answer_too_long');
    end if;
    if v_field.kind = 'choice' and not (v_value = any (v_field.options)) then
      perform private.fail(format('Elegí una opción en "%s".', v_field.label), 'invalid_choice');
    end if;
    if v_field.kind = 'yes_no' and v_value not in ('Sí', 'No') then
      perform private.fail(format('Respondé sí o no en "%s".', v_field.label), 'invalid_choice');
    end if;
    v_answers := v_answers || jsonb_build_object(v_field.id::text, v_value);
  end loop;

  if v_a.video_mode = 'none' then
    v_video := null;
  elsif v_video is null and v_a.video_mode = 'required' then
    perform private.fail('Pegá el link a tu video.', 'video_required');
  elsif v_video is not null and v_video !~ '^https://[^\s]+$' then
    perform private.fail('El link del video tiene que empezar con https://', 'invalid_video');
  end if;

  if v_a.uses_slots then
    if p_slot_id is null then
      perform private.fail('Elegí un turno.', 'slot_required');
    end if;
    select * into v_slot from public.audition_slots where id = p_slot_id and audition_id = v_a.id for update;
    if not found or v_slot.starts_at <= now() then
      perform private.fail('Ese turno ya no está disponible.', 'slot_not_found');
    end if;
    -- Su propia reserva vigente en este turno no cuenta.
    if v_app.slot_id = v_slot.id and v_app.status = 'pending_payment' and v_app.hold_expires_at > now() then
      v_held := 1;
    end if;
    if private.audition_slot_taken(v_slot.id) - v_held >= v_slot.capacity then
      perform private.fail('Ese turno se completó. Elegí otro.', 'slot_full');
    end if;
  end if;

  if v_a.fee_cents > 0 and (
    not public.studio_has_feature(v_a.studio_id, 'mp_checkout')
    or not exists (select 1 from public.mp_connections where studio_id = v_a.studio_id)
  ) then
    perform private.fail('El estudio todavía no cobra online. Consultá cómo pagar el arancel.', 'mp_not_connected');
  end if;

  if v_app.id is null then
    insert into public.audition_applications (studio_id, audition_id, formation_id, student_id)
    values (v_a.studio_id, v_a.id, v_a.formation_id, v_student.id)
    returning * into v_app;
  end if;

  update public.audition_applications set
    answers = v_answers,
    video_url = v_video,
    slot_id = case when v_a.uses_slots then v_slot.id end,
    fee_cents = v_a.fee_cents,
    status = case when v_a.fee_cents > 0 then 'pending_payment' else 'submitted' end::public.audition_application_status,
    hold_expires_at = case when v_a.fee_cents > 0 then now() + interval '20 minutes' end
  where id = v_app.id
  returning * into v_app;

  if v_app.status = 'submitted' then
    perform private.audition_submitted(v_app.id);
  end if;
  return v_app;
end;
$$;

/** Arancel pagado (webhook o mostrador): queda inscripto. Idempotente. */
create function private.audition_fee_paid(p_application_id uuid, p_method public.payment_method, p_mp_payment_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.audition_applications set status = 'submitted', method = p_method, paid_at = now(),
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id), hold_expires_at = null
  where id = p_application_id and status = 'pending_payment';
  if found then
    perform private.audition_submitted(p_application_id);
  end if;
end;
$$;

revoke execute on function private.audition_fee_paid(uuid, public.payment_method, text) from public, anon, authenticated;

create function public.mp_apply_audition_payment(
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
  v_app public.audition_applications%rowtype;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;
  select * into v_app from public.audition_applications where external_reference = p_external_reference for update;
  if not found then
    perform private.fail('No encontramos esa inscripción.', 'application_not_found');
  end if;
  if p_mp_status = 'approved' then
    if v_app.paid_at is not null then
      return jsonb_build_object('application_id', v_app.id, 'status', v_app.status, 'ignored', 'already_paid');
    end if;
    if p_amount_cents is distinct from v_app.fee_cents then
      update public.audition_applications set staff_notes = concat_ws(E'\n', staff_notes,
        format('MP %s aprobado por %s centavos (esperado %s): revisar.', p_mp_payment_id, p_amount_cents, v_app.fee_cents))
      where id = v_app.id;
      return jsonb_build_object('application_id', v_app.id, 'status', v_app.status, 'ignored', 'amount_mismatch');
    end if;
    -- Aunque la reserva del turno haya vencido, se acepta (la plata ya se cobró).
    update public.audition_applications set status = 'pending_payment' where id = v_app.id and status = 'cancelled';
    perform private.audition_fee_paid(v_app.id, 'mercadopago', p_mp_payment_id);
    return jsonb_build_object('application_id', v_app.id, 'status', 'submitted');
  end if;
  return jsonb_build_object('application_id', v_app.id, 'status', v_app.status);
end;
$$;

create function public.record_audition_payment(p_application_id uuid, p_method public.payment_method)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.audition_applications%rowtype;
begin
  select * into v_app from public.audition_applications where id = p_application_id for update;
  if not found or not (private.is_privileged() or private.is_studio_staff(v_app.studio_id)) then
    perform private.fail('No encontramos esa inscripción.', 'application_not_found');
  end if;
  if not private.can_take_payments(v_app.studio_id) then
    perform private.fail('No tenés permiso para registrar pagos. Pedíselo al dueño del estudio.', 'cannot_take_payments');
  end if;
  if p_method is null or p_method = 'mercadopago' then
    perform private.fail('Elegí efectivo o transferencia.', 'invalid_method');
  end if;
  if v_app.status <> 'pending_payment' then
    perform private.fail('Este arancel no está pendiente.', 'not_pending');
  end if;
  perform private.audition_fee_paid(v_app.id, p_method);
end;
$$;

-- -----------------------------------------------------------------------------
-- Resultado (admin). Admitido → aprobado en la formación (matrícula).
-- -----------------------------------------------------------------------------
create function public.set_audition_result(
  p_application_id uuid,
  p_result public.audition_application_status,
  p_notes text default null
)
returns public.audition_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.audition_applications%rowtype;
  v_f public.formations%rowtype;
  v_enrollment_id uuid;
begin
  select * into v_app from public.audition_applications where id = p_application_id for update;
  if not found or not private.is_studio_admin(v_app.studio_id) then
    perform private.fail('No encontramos esa inscripción.', 'application_not_found');
  end if;
  if p_result not in ('admitted', 'waitlisted', 'rejected') then
    perform private.fail('Elegí admitido, lista de espera o no admitido.', 'invalid_result');
  end if;
  if v_app.status not in ('submitted', 'waitlisted') then
    perform private.fail(
      case when v_app.status = 'pending_payment' then 'Todavía no pagó el arancel.' else 'Esta inscripción ya tiene un resultado.' end,
      'cannot_decide'
    );
  end if;

  if p_result = 'admitted' then
    select * into v_f from public.formations where id = v_app.formation_id for update;
    if v_f.capacity is not null and (
      select count(*) from public.formation_enrollments e
      where e.formation_id = v_f.id and e.status in ('approved', 'enrolled')
    ) >= v_f.capacity then
      perform private.fail('Ya completaste el cupo de la formación.', 'formation_full');
    end if;
    select id into v_enrollment_id from public.formation_enrollments
    where formation_id = v_f.id and student_id = v_app.student_id;
    if v_enrollment_id is null then
      insert into public.formation_enrollments (studio_id, formation_id, student_id, application_message)
      values (v_app.studio_id, v_f.id, v_app.student_id, 'Admitido/a por audición.')
      returning id into v_enrollment_id;
    else
      update public.formation_enrollments set status = 'applied'
      where id = v_enrollment_id and status in ('rejected', 'withdrawn');
    end if;
    perform private.formation_approve(v_enrollment_id);
  end if;

  update public.audition_applications set status = p_result, decided_at = now(), decided_by = auth.uid(),
    staff_notes = case when nullif(btrim(coalesce(p_notes, '')), '') is null then staff_notes
                       else concat_ws(E'\n', staff_notes, btrim(p_notes)) end
  where id = v_app.id
  returning * into v_app;

  -- El admitido recibe el mail de la formación (matrícula); los demás, el de la audición.
  if p_result <> 'admitted' then
    perform private.enqueue_notification(
      v_app.studio_id, v_app.student_id, 'audition_result',
      jsonb_build_object('application_id', v_app.id, 'result', p_result), now(),
      'audition_result:' || v_app.id || ':' || p_result
    );
  end if;
  return v_app;
end;
$$;

create function public.cancel_audition_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.audition_applications%rowtype;
begin
  select * into v_app from public.audition_applications where id = p_application_id for update;
  if not found or not private.is_studio_admin(v_app.studio_id) then
    perform private.fail('No encontramos esa inscripción.', 'application_not_found');
  end if;
  if v_app.status = 'admitted' then
    perform private.fail('Ya fue admitido/a: dalo de baja desde la formación.', 'already_admitted');
  end if;
  update public.audition_applications set status = 'cancelled', slot_id = null where id = v_app.id;
end;
$$;

-- Recordatorio el día anterior al turno (cron diario).
create function private.enqueue_audition_reminders()
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
    select ap.id, ap.studio_id, ap.student_id
    from public.audition_applications ap
    join public.audition_slots s on s.id = ap.slot_id
    join public.studios st on st.id = ap.studio_id
    where ap.status = 'submitted'
      and (s.starts_at at time zone st.timezone)::date = (now() at time zone st.timezone)::date + 1
  loop
    perform private.enqueue_notification(v_row.studio_id, v_row.student_id, 'audition_reminder',
      jsonb_build_object('application_id', v_row.id), now(), 'audition_reminder:' || v_row.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.enqueue_audition_reminders() from public, anon, authenticated;

grant execute on function public.audition_slot_availability(uuid) to anon, authenticated, service_role;
grant execute on function public.apply_to_audition(uuid, jsonb, text, uuid) to authenticated;
grant execute on function public.mp_apply_audition_payment(uuid, text, text, bigint) to service_role;
grant execute on function public.record_audition_payment(uuid, public.payment_method) to authenticated, service_role;
grant execute on function public.set_audition_result(uuid, public.audition_application_status, text) to authenticated;
grant execute on function public.cancel_audition_application(uuid) to authenticated;

-- Recordatorios de turnos: todos los días a las 10:00 ART.
select cron.schedule('giroa_audition_reminders', '0 13 * * *', $$select private.enqueue_audition_reminders()$$);
