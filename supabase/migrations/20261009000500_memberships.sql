-- =============================================================================
-- Abonos mensuales con débito automático (feature 'memberships', Estudio y Pro).
--
-- El estudio marca un pack como abono (pack_products.is_membership). El alumno
-- se suscribe con MP Suscripciones (preapproval) en la cuenta del estudio: cada
-- cobro aprobado crea un pago y el pack del mes, que vale hasta el próximo cobro
-- (+3 días de margen). Al renovar, lo que no usó del mes anterior se pierde.
-- Si un cobro rebota, el abono queda 'past_due' (MP reintenta solo).
--
-- Flujo: start_membership (alumno) → el servidor crea el preapproval con el token
-- del estudio y lo vincula (mp_link_membership) → el webhook aplica el estado
-- (mp_apply_membership) y cada cobro (mp_apply_membership_charge).
-- =============================================================================

insert into public.plan_features (plan, feature) values ('estudio', 'memberships'), ('pro', 'memberships')
on conflict do nothing;

alter table public.pack_products add column is_membership boolean not null default false;

create type public.membership_status as enum ('pending', 'active', 'past_due', 'cancelled');

create table public.student_subscriptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  student_id uuid not null,
  pack_product_id uuid not null,
  name text not null, -- copia del nombre del pack al suscribirse
  amount_cents bigint not null check (amount_cents > 0),
  status public.membership_status not null default 'pending',
  mp_preapproval_id text unique,
  next_charge_at timestamptz,
  last_charge_at timestamptz,
  -- Último cobro rechazado (se limpia con el próximo aprobado).
  failed_at timestamptz,
  last_error text check (char_length(last_error) <= 500),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete restrict,
  foreign key (studio_id, pack_product_id) references public.pack_products (studio_id, id) on delete restrict
);

-- Un abono vivo por alumno y pack.
create unique index student_subscriptions_live_idx on public.student_subscriptions (student_id, pack_product_id)
  where status <> 'cancelled';
create index student_subscriptions_studio_idx on public.student_subscriptions (studio_id, status);

create trigger student_subscriptions_updated_at before update on public.student_subscriptions
  for each row execute function private.set_updated_at();

alter table public.payments add column subscription_id uuid;
alter table public.payments add foreign key (studio_id, subscription_id)
  references public.student_subscriptions (studio_id, id) on delete restrict;
create index payments_subscription_idx on public.payments (subscription_id) where subscription_id is not null;

alter table public.student_subscriptions enable row level security;
revoke all on public.student_subscriptions from anon, authenticated;
grant select on public.student_subscriptions to authenticated;

create policy student_subscriptions_read on public.student_subscriptions for select to authenticated
  using (private.is_studio_admin(studio_id) or student_id in (select private.my_student_ids()));

-- -----------------------------------------------------------------------------
-- El alumno empieza a abonarse. Si ya tiene uno pendiente de ese pack, se reusa
-- (volvió de MP sin terminar). El monto es el del pack, nunca el del cliente.
-- -----------------------------------------------------------------------------
create function public.start_membership(p_pack_product_id uuid)
returns public.student_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.pack_products%rowtype;
  v_student public.students%rowtype;
  v_sub public.student_subscriptions%rowtype;
begin
  if v_uid is null then
    perform private.fail('Tenés que iniciar sesión para abonarte.', 'not_authenticated');
  end if;

  select * into v_product from public.pack_products where id = p_pack_product_id and is_active;
  if not found or not v_product.is_membership then
    perform private.fail('Este abono ya no está disponible.', 'pack_not_found');
  end if;
  if not public.studio_has_feature(v_product.studio_id, 'memberships') then
    perform private.fail('Este estudio no tiene abonos mensuales.', 'feature_unavailable');
  end if;
  if v_product.price_cents <= 0 then
    perform private.fail('Este abono no tiene precio. Consultá en el estudio.', 'invalid_amount');
  end if;

  select * into v_student from public.students where studio_id = v_product.studio_id and user_id = v_uid;
  if not found then
    perform private.fail('Todavía no sos alumno/a de este estudio. Sumate para abonarte.', 'not_a_student');
  end if;
  if not v_student.is_active then
    perform private.fail('Esta cuenta está inactiva en el estudio. Hablá con el estudio para reactivarla.', 'student_inactive');
  end if;

  if not exists (select 1 from public.mp_connections where studio_id = v_product.studio_id) then
    perform private.fail('Este estudio todavía no cobra online. Consultá en el estudio cómo pagar.', 'mp_not_connected');
  end if;

  select * into v_sub from public.student_subscriptions
  where student_id = v_student.id and pack_product_id = v_product.id and status <> 'cancelled'
  for update;
  if found then
    if v_sub.status <> 'pending' then
      perform private.fail('Ya tenés este abono. Lo ves en tu perfil.', 'already_subscribed');
    end if;
    update public.student_subscriptions set amount_cents = v_product.price_cents, name = v_product.name
    where id = v_sub.id returning * into v_sub;
    return v_sub;
  end if;

  insert into public.student_subscriptions (studio_id, student_id, pack_product_id, name, amount_cents)
  values (v_product.studio_id, v_student.id, v_product.id, v_product.name, v_product.price_cents)
  returning * into v_sub;
  return v_sub;
end;
$$;

-- El servidor guarda el id del débito que creó en MP (solo service role).
create function public.mp_link_membership(p_subscription_id uuid, p_preapproval_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;
  update public.student_subscriptions set mp_preapproval_id = p_preapproval_id
  where id = p_subscription_id and status = 'pending';
end;
$$;

-- -----------------------------------------------------------------------------
-- Estado del débito consultado a la API de MP (authorized | paused | cancelled
-- | pending). Solo service role. Un abono cancelado no revive.
-- -----------------------------------------------------------------------------
create function public.mp_apply_membership(
  p_subscription_id uuid,
  p_preapproval_id text,
  p_status text,
  p_next_charge_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.student_subscriptions%rowtype;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  select * into v_sub from public.student_subscriptions where id = p_subscription_id for update;
  if not found then
    perform private.fail('No encontramos ese abono.', 'subscription_not_found');
  end if;
  -- Un débito viejo (el alumno reintentó y quedó otro) no toca el actual.
  if v_sub.mp_preapproval_id is not null and v_sub.mp_preapproval_id <> p_preapproval_id then
    return jsonb_build_object('status', v_sub.status, 'ignored', 'other_preapproval');
  end if;
  if v_sub.status = 'cancelled' then
    return jsonb_build_object('status', v_sub.status, 'ignored', 'cancelled');
  end if;

  if p_status = 'authorized' then
    update public.student_subscriptions set
      mp_preapproval_id = p_preapproval_id,
      status = case when status = 'pending' then 'active'::public.membership_status else status end,
      next_charge_at = coalesce(p_next_charge_at, next_charge_at)
    where id = v_sub.id returning * into v_sub;
  elsif p_status = 'paused' then
    update public.student_subscriptions set mp_preapproval_id = p_preapproval_id, status = 'past_due',
      failed_at = coalesce(failed_at, now())
    where id = v_sub.id returning * into v_sub;
  elsif p_status = 'cancelled' then
    update public.student_subscriptions set mp_preapproval_id = p_preapproval_id, status = 'cancelled',
      cancelled_at = now()
    where id = v_sub.id returning * into v_sub;
  end if;

  return jsonb_build_object('status', v_sub.status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Un cobro del débito. Aprobado: pago + pack del mes (vence el anterior).
-- Rechazado: queda 'past_due' con el motivo. Idempotente por id de pago de MP.
-- -----------------------------------------------------------------------------
create function public.mp_apply_membership_charge(
  p_preapproval_id text,
  p_mp_payment_id text,
  p_approved boolean,
  p_amount_cents bigint,
  p_paid_at timestamptz default null,
  p_next_charge_at timestamptz default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.student_subscriptions%rowtype;
  v_product public.pack_products%rowtype;
  v_payment public.payments%rowtype;
  v_pack public.student_packs%rowtype;
  v_tz text;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_expires timestamptz;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  select * into v_sub from public.student_subscriptions where mp_preapproval_id = p_preapproval_id for update;
  if not found then
    perform private.fail('No encontramos ese abono.', 'subscription_not_found');
  end if;

  if not p_approved then
    if v_sub.status <> 'cancelled' then
      update public.student_subscriptions set status = 'past_due', failed_at = coalesce(failed_at, now()),
        last_error = left(coalesce(p_error, 'Cobro rechazado'), 500)
      where id = v_sub.id;
    end if;
    return jsonb_build_object('status', 'past_due');
  end if;

  select * into v_payment from public.payments where mp_payment_id = p_mp_payment_id;
  if found then
    return jsonb_build_object('payment_id', v_payment.id, 'duplicate', true);
  end if;

  select * into v_product from public.pack_products where id = v_sub.pack_product_id;
  select timezone into v_tz from public.studios where id = v_sub.studio_id;

  insert into public.payments (
    studio_id, student_id, purpose, pack_product_id, subscription_id, amount_cents,
    method, status, mp_payment_id, paid_at, created_by
  ) values (
    v_sub.studio_id, v_sub.student_id, 'pack', v_sub.pack_product_id, v_sub.id, coalesce(nullif(p_amount_cents, 0), v_sub.amount_cents),
    'mercadopago', 'approved', p_mp_payment_id, v_paid_at, null
  ) returning * into v_payment;

  -- Lo que quedó del mes anterior se pierde.
  with old as (
    update public.student_packs sp set status = 'expired', expires_at = greatest(sp.starts_at + interval '1 second', v_paid_at)
    from public.payments p
    where p.id = sp.payment_id and p.subscription_id = v_sub.id and sp.status = 'active'
    returning sp.id, sp.studio_id, sp.credits_total, sp.credits_used
  )
  insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note)
  select studio_id, id, 'expire', -coalesce(credits_total - credits_used, 0), 'Renovación del abono' from old;

  v_pack := private.grant_pack_core(v_payment.id);

  -- Vale hasta el próximo cobro (+3 días por si MP cobra tarde).
  v_expires := case
    when p_next_charge_at is not null and p_next_charge_at > v_paid_at then p_next_charge_at + interval '3 days'
    else private.pack_expires_at(v_tz, v_paid_at, coalesce(v_product.validity_days, 30))
  end;
  update public.student_packs set expires_at = v_expires where id = v_pack.id;

  update public.student_subscriptions set
    status = case when status = 'cancelled' then status else 'active'::public.membership_status end,
    last_charge_at = v_paid_at,
    next_charge_at = coalesce(p_next_charge_at, next_charge_at),
    failed_at = null,
    last_error = null
  where id = v_sub.id;

  return jsonb_build_object('payment_id', v_payment.id, 'student_pack_id', v_pack.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Baja del abono: el alumno o el dueño/encargado. El servidor ya lo canceló en
-- MP. Lo pagado sigue valiendo hasta que vence.
-- -----------------------------------------------------------------------------
create function public.cancel_membership(p_subscription_id uuid)
returns public.student_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.student_subscriptions%rowtype;
begin
  select * into v_sub from public.student_subscriptions where id = p_subscription_id for update;
  if not found or not (
    private.is_privileged()
    or private.is_studio_admin(v_sub.studio_id)
    or v_sub.student_id in (select private.my_student_ids())
  ) then
    perform private.fail('No encontramos ese abono.', 'subscription_not_found');
  end if;
  if v_sub.status = 'cancelled' then
    return v_sub;
  end if;

  update public.student_subscriptions set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
  where id = v_sub.id returning * into v_sub;
  return v_sub;
end;
$$;

revoke execute on function public.start_membership(uuid) from public, anon, authenticated;
revoke execute on function public.mp_link_membership(uuid, text) from public, anon, authenticated;
revoke execute on function public.mp_apply_membership(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.mp_apply_membership_charge(text, text, boolean, bigint, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.cancel_membership(uuid) from public, anon, authenticated;

grant execute on function public.start_membership(uuid) to authenticated;
grant execute on function public.mp_link_membership(uuid, text) to service_role;
grant execute on function public.mp_apply_membership(uuid, text, text, timestamptz) to service_role;
grant execute on function public.mp_apply_membership_charge(text, text, boolean, bigint, timestamptz, timestamptz, text) to service_role;
grant execute on function public.cancel_membership(uuid) to authenticated, service_role;
