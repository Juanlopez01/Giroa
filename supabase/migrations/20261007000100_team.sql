-- =============================================================================
-- Equipo con permisos (feature 'teacher_permissions', planes Estudio y Pro).
--
-- El dueño o un encargado (admin) invita por email. La persona entra con ese
-- email y acepta la invitación: queda como encargado o profe. Al profe se le
-- puede habilitar "puede cobrar" (registrar pagos en efectivo o transferencia).
-- =============================================================================

alter table public.studio_members add column can_take_payments boolean not null default false;

create table public.studio_invites (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text check (char_length(display_name) <= 120),
  role public.member_role not null check (role <> 'owner'),
  can_take_payments boolean not null default false,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (studio_id, id)
);

create unique index studio_invites_one_pending on public.studio_invites (studio_id, email)
  where accepted_at is null and cancelled_at is null;

alter table public.studio_invites enable row level security;
revoke all on public.studio_invites from anon, authenticated;
grant select (id, studio_id, email, display_name, role, can_take_payments, expires_at, accepted_at, cancelled_at, created_at)
  on public.studio_invites to authenticated;

create policy studio_invites_admin_read on public.studio_invites for select to authenticated
  using (private.is_studio_admin(studio_id));

-- ¿Puede registrar pagos manuales? Admin siempre; profe solo con el permiso.
create function private.can_take_payments(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_privileged() or exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio_id and m.user_id = auth.uid()
      and (m.role in ('owner', 'admin') or m.can_take_payments)
  )
$$;

grant execute on function private.can_take_payments(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Invitar (o reenviar una invitación pendiente).
-- -----------------------------------------------------------------------------
create function public.invite_member(
  p_studio_id uuid,
  p_email text,
  p_role public.member_role,
  p_display_name text default null,
  p_can_take_payments boolean default false
)
returns public.studio_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_invite public.studio_invites%rowtype;
begin
  if not private.is_studio_admin(p_studio_id) then
    perform private.fail('Solo el dueño o un encargado pueden invitar al equipo.', 'forbidden');
  end if;
  if not public.studio_has_feature(p_studio_id, 'teacher_permissions') then
    perform private.fail('Sumar gente al equipo no está incluido en tu plan.', 'feature_not_in_plan');
  end if;
  if p_role is null or p_role = 'owner' then
    perform private.fail('Elegí si va como encargado o profe.', 'invalid_role');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.fail('Revisá el email.', 'invalid_email');
  end if;
  if exists (
    select 1 from public.studio_members m join auth.users u on u.id = m.user_id
    where m.studio_id = p_studio_id and lower(u.email) = v_email
  ) then
    perform private.fail('Esa persona ya es parte del equipo.', 'already_member');
  end if;

  -- Si ya había una pendiente, se actualiza y se renueva (reenviar).
  update public.studio_invites set
    role = p_role,
    display_name = coalesce(v_name, display_name),
    can_take_payments = coalesce(p_can_take_payments, false) and p_role = 'teacher',
    token = encode(extensions.gen_random_bytes(16), 'hex'),
    expires_at = now() + interval '7 days',
    invited_by = auth.uid()
  where studio_id = p_studio_id and email = v_email and accepted_at is null and cancelled_at is null
  returning * into v_invite;

  if not found then
    insert into public.studio_invites (studio_id, email, display_name, role, can_take_payments, invited_by)
    values (p_studio_id, v_email, v_name, p_role, coalesce(p_can_take_payments, false) and p_role = 'teacher', auth.uid())
    returning * into v_invite;
  end if;

  insert into public.notifications (studio_id, template, to_address, payload, dedupe_key)
  values (
    p_studio_id, 'staff_invite', v_email,
    jsonb_build_object('invite_id', v_invite.id, 'token', v_invite.token, 'role', v_invite.role, 'name', v_invite.display_name),
    'staff_invite:' || v_invite.id || ':' || v_invite.token
  );

  return v_invite;
end;
$$;

create function public.cancel_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio_id uuid;
begin
  select studio_id into v_studio_id from public.studio_invites where id = p_invite_id;
  if v_studio_id is null or not private.is_studio_admin(v_studio_id) then
    perform private.fail('No encontramos esa invitación.', 'invite_not_found');
  end if;
  update public.studio_invites set cancelled_at = now()
  where id = p_invite_id and accepted_at is null and cancelled_at is null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Aceptar: con la sesión del email invitado.
-- -----------------------------------------------------------------------------

/** Datos para la pantalla de la invitación (el token es el secreto). */
create function public.get_invite(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email', i.email,
    'role', i.role,
    'display_name', i.display_name,
    'status', case
      when i.accepted_at is not null then 'accepted'
      when i.cancelled_at is not null then 'cancelled'
      when i.expires_at <= now() then 'expired'
      else 'pending' end,
    'studio', jsonb_build_object('name', s.name, 'slug', s.slug)
  )
  from public.studio_invites i
  join public.studios s on s.id = i.studio_id
  where i.token = p_token
$$;

create function public.accept_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.studio_invites%rowtype;
  v_slug text;
begin
  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión para aceptar la invitación.', 'not_authenticated');
  end if;

  select * into v_invite from public.studio_invites where token = p_token for update;
  if not found or v_invite.cancelled_at is not null then
    perform private.fail('Esta invitación no existe o fue cancelada.', 'invite_not_found');
  end if;
  select slug into v_slug from public.studios where id = v_invite.studio_id;

  if v_invite.accepted_at is not null then
    if v_invite.accepted_by = v_uid then
      return jsonb_build_object('slug', v_slug, 'role', v_invite.role);
    end if;
    perform private.fail('Esta invitación ya se usó.', 'invite_used');
  end if;
  if v_invite.expires_at <= now() then
    perform private.fail('La invitación venció. Pedile al estudio que te la reenvíe.', 'invite_expired');
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is distinct from v_invite.email then
    perform private.fail(
      format('Esta invitación es para %s. Entrá con ese email para aceptarla.', v_invite.email),
      'wrong_email'
    );
  end if;

  insert into public.studio_members (studio_id, user_id, role, display_name, can_take_payments)
  values (v_invite.studio_id, v_uid, v_invite.role, v_invite.display_name, v_invite.can_take_payments)
  on conflict (studio_id, user_id) do nothing;

  update public.studio_invites set accepted_at = now(), accepted_by = v_uid where id = v_invite.id;

  return jsonb_build_object('slug', v_slug, 'role', v_invite.role);
end;
$$;

-- -----------------------------------------------------------------------------
-- Cambiar rol / permiso de cobro y sacar del equipo.
-- -----------------------------------------------------------------------------
create function public.update_member(p_member_id uuid, p_role public.member_role, p_can_take_payments boolean)
returns public.studio_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.studio_members%rowtype;
begin
  select * into v_member from public.studio_members where id = p_member_id for update;
  if not found or not private.is_studio_admin(v_member.studio_id) then
    perform private.fail('No encontramos a esa persona en el equipo.', 'member_not_found');
  end if;
  if v_member.role = 'owner' then
    perform private.fail('Al dueño del estudio no se le pueden cambiar los permisos.', 'is_owner');
  end if;
  if v_member.user_id = auth.uid() then
    perform private.fail('No podés cambiar tus propios permisos.', 'is_self');
  end if;
  if p_role is null or p_role = 'owner' then
    perform private.fail('Elegí si es encargado o profe.', 'invalid_role');
  end if;

  update public.studio_members set
    role = p_role,
    can_take_payments = coalesce(p_can_take_payments, false) and p_role = 'teacher'
  where id = v_member.id
  returning * into v_member;
  return v_member;
end;
$$;

create function public.remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.studio_members%rowtype;
begin
  select * into v_member from public.studio_members where id = p_member_id for update;
  if not found or not private.is_studio_admin(v_member.studio_id) then
    perform private.fail('No encontramos a esa persona en el equipo.', 'member_not_found');
  end if;
  if v_member.role = 'owner' then
    perform private.fail('Al dueño del estudio no se lo puede sacar.', 'is_owner');
  end if;
  if v_member.user_id = auth.uid() then
    perform private.fail('No te podés sacar a vos mismo del equipo.', 'is_self');
  end if;
  delete from public.studio_members where id = v_member.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- record_manual_payment: ahora pide permiso de cobro (admin o profe habilitado).
-- -----------------------------------------------------------------------------
create or replace function public.record_manual_payment(
  p_student_id uuid,
  p_pack_product_id uuid,
  p_method public.payment_method,
  p_amount_cents bigint default null,
  p_notes text default null,
  p_partner_student_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_product public.pack_products%rowtype;
  v_payment public.payments%rowtype;
  v_pack public.student_packs%rowtype;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found or not (private.is_privileged() or private.is_studio_staff(v_student.studio_id)) then
    perform private.fail('No encontramos a ese alumno en el estudio.', 'student_not_found');
  end if;
  if not private.can_take_payments(v_student.studio_id) then
    perform private.fail('No tenés permiso para registrar pagos. Pedíselo al dueño del estudio.', 'cannot_take_payments');
  end if;

  if p_method not in ('cash', 'transfer') then
    perform private.fail('Los pagos manuales son en efectivo o por transferencia.', 'invalid_method');
  end if;

  select * into v_product from public.pack_products
  where id = p_pack_product_id and studio_id = v_student.studio_id;
  if not found then
    perform private.fail('No encontramos ese pack.', 'pack_not_found');
  end if;

  if p_amount_cents is not null and p_amount_cents < 0 then
    perform private.fail('El monto no puede ser negativo.', 'invalid_amount');
  end if;

  if p_partner_student_id is not null then
    if not v_product.is_couple then
      perform private.fail('Este pack no es de pareja.', 'not_couple_pack');
    end if;
    if p_partner_student_id = p_student_id or not exists (
      select 1 from public.students
      where id = p_partner_student_id and studio_id = v_student.studio_id
    ) then
      perform private.fail('No encontramos a la pareja en el estudio.', 'partner_not_found');
    end if;
  end if;

  insert into public.payments (
    studio_id, student_id, partner_student_id, purpose, pack_product_id,
    amount_cents, method, status, paid_at, notes, created_by
  ) values (
    v_student.studio_id, v_student.id, p_partner_student_id, 'pack', v_product.id,
    coalesce(p_amount_cents, v_product.price_cents), p_method, 'approved', now(),
    nullif(btrim(p_notes), ''), auth.uid()
  )
  returning * into v_payment;

  v_pack := private.grant_pack_core(v_payment.id);

  return jsonb_build_object('payment_id', v_payment.id, 'student_pack_id', v_pack.id);
end;
$$;

grant execute on function public.invite_member(uuid, text, public.member_role, text, boolean) to authenticated;
grant execute on function public.cancel_invite(uuid) to authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.update_member(uuid, public.member_role, boolean) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
