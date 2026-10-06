-- =============================================================================
-- Suscripción autogestionada a Giroa (Mercado Pago Suscripciones, cobra en la
-- cuenta de Giroa).
--   * Prueba de 14 días sin tarjeta; durante la prueba el estudio puede elegir
--     qué plan probar.
--   * Al terminar la prueba o si falla un cobro: 7 días de gracia; después el
--     panel queda bloqueado (los alumnos siguen reservando con lo que pagaron).
--   * Códigos de fundador: los carga Giroa; descuento fijo de por vida.
-- Las escrituras las hace solo el servidor (service role) a partir del webhook.
-- =============================================================================

alter table public.studio_subscriptions
  add column plan public.studio_plan,
  add column amount_cents bigint check (amount_cents >= 0),
  add column discount_pct smallint not null default 0 check (discount_pct between 0 and 100),
  add column coupon_code text,
  add column grace_until timestamptz,
  add column last_payment_at timestamptz,
  add column cancelled_at timestamptz;

-- Códigos de descuento de Giroa (fundadores, promos). Sin políticas: solo servidor.
create table public.giroa_coupons (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  discount_pct smallint not null check (discount_pct between 1 and 100),
  max_uses integer check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.giroa_coupons enable row level security;
revoke all on public.giroa_coupons from anon, authenticated;

insert into public.giroa_coupons (code, discount_pct, max_uses) values ('FUNDADOR', 50, 10);

-- -----------------------------------------------------------------------------
-- Estado de acceso del estudio: 'trial' | 'active' | 'grace' | 'blocked'.
-- -----------------------------------------------------------------------------
create function public.studio_access(p_studio_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.studio_subscriptions%rowtype;
  v_state text;
  v_until timestamptz;
begin
  if not (private.is_privileged() or private.is_studio_staff(p_studio_id)) then
    perform private.fail('No tenés permiso para ver esta información.', 'forbidden');
  end if;

  select * into v_sub from public.studio_subscriptions where studio_id = p_studio_id;
  if not found then
    return jsonb_build_object('state', 'blocked');
  end if;

  if v_sub.status = 'active' then
    v_state := 'active';
  elsif v_sub.status = 'trialing' then
    if v_sub.trial_ends_at is null or now() < v_sub.trial_ends_at then
      v_state := 'trial';
      v_until := v_sub.trial_ends_at;
    elsif now() < v_sub.trial_ends_at + interval '7 days' then
      v_state := 'grace';
      v_until := v_sub.trial_ends_at + interval '7 days';
    else
      v_state := 'blocked';
    end if;
  elsif v_sub.status = 'past_due' then
    v_until := coalesce(v_sub.grace_until, now());
    v_state := case when now() < v_until then 'grace' else 'blocked' end;
  else -- cancelled: vale hasta el fin del período pagado
    if v_sub.current_period_end is not null and now() < v_sub.current_period_end then
      v_state := 'active';
      v_until := v_sub.current_period_end;
    else
      v_state := 'blocked';
    end if;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'until', v_until,
    'status', v_sub.status,
    'plan', (select plan from public.studios where id = p_studio_id),
    'subscribed_plan', v_sub.plan,
    'billing_cycle', v_sub.billing_cycle,
    'amount_cents', v_sub.amount_cents,
    'discount_pct', v_sub.discount_pct,
    'has_subscription', v_sub.mp_preapproval_id is not null and v_sub.status in ('active', 'past_due'),
    'current_period_end', v_sub.current_period_end
  );
end;
$$;

-- Durante la prueba (sin suscripción), owner/admin eligen qué plan probar.
create function public.choose_trial_plan(p_studio_id uuid, p_plan public.studio_plan)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('No tenés permiso para cambiar el plan.', 'forbidden');
  end if;
  if not exists (select 1 from public.studio_subscriptions where studio_id = p_studio_id and status = 'trialing') then
    perform private.fail('Para cambiar de plan, suscribite al plan nuevo.', 'not_in_trial');
  end if;
  update public.studios set plan = p_plan where id = p_studio_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Solo servidor: precio de una suscripción (con código) y aplicar eventos de MP.
-- -----------------------------------------------------------------------------
create function public.giroa_quote(p_plan public.studio_plan, p_cycle public.billing_cycle, p_coupon text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_monthly bigint;
  v_discount smallint := 0;
  v_code text := nullif(upper(btrim(p_coupon)), '');
  v_base bigint;
begin
  select monthly_price_cents into v_monthly from public.plans where key = p_plan;
  if v_monthly is null then
    perform private.fail('Ese plan no existe.', 'plan_not_found');
  end if;

  if v_code is not null then
    select c.discount_pct into v_discount from public.giroa_coupons c
    where c.code = v_code and c.is_active and (c.max_uses is null or c.used_count < c.max_uses);
    if v_discount is null then
      perform private.fail('Ese código no es válido o ya se usó todas las veces.', 'invalid_coupon');
    end if;
  end if;

  -- Anual: 2 meses gratis (se pagan 10).
  v_base := case when p_cycle = 'annual' then v_monthly * 10 else v_monthly end;
  return jsonb_build_object(
    'plan', p_plan,
    'cycle', p_cycle,
    'base_cents', v_base,
    'discount_pct', coalesce(v_discount, 0),
    'amount_cents', round(v_base * (100 - coalesce(v_discount, 0)) / 100.0)::bigint,
    'coupon', v_code
  );
end;
$$;

-- Aplica el estado de una suscripción de MP (preapproval) consultado a la API.
-- p_status: authorized | paused | cancelled | pending.
create function public.giroa_apply_preapproval(
  p_studio_id uuid,
  p_preapproval_id text,
  p_status text,
  p_plan public.studio_plan,
  p_cycle public.billing_cycle,
  p_amount_cents bigint,
  p_discount_pct smallint,
  p_coupon text,
  p_next_payment_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.studio_subscriptions%rowtype;
  v_previous text;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  select * into v_sub from public.studio_subscriptions where studio_id = p_studio_id for update;
  if not found then
    perform private.fail('No encontramos el estudio.', 'studio_not_found');
  end if;

  if p_status = 'authorized' then
    -- Ya aplicada (webhook repetido): no se cuenta el código dos veces.
    if v_sub.mp_preapproval_id = p_preapproval_id and v_sub.status = 'active' then
      return jsonb_build_object('previous_preapproval_id', null, 'changed', false);
    end if;
    v_previous := case when v_sub.mp_preapproval_id is distinct from p_preapproval_id then v_sub.mp_preapproval_id end;

    update public.studio_subscriptions set
      status = 'active',
      plan = p_plan,
      billing_cycle = p_cycle,
      amount_cents = p_amount_cents,
      discount_pct = coalesce(p_discount_pct, 0),
      founder_discount_pct = coalesce(p_discount_pct, 0),
      coupon_code = p_coupon,
      mp_preapproval_id = p_preapproval_id,
      payment_method = 'mercadopago',
      grace_until = null,
      cancelled_at = null,
      current_period_end = coalesce(p_next_payment_at, current_period_end)
    where studio_id = p_studio_id;

    update public.studios set plan = p_plan where id = p_studio_id;

    if p_coupon is not null and v_sub.coupon_code is distinct from p_coupon then
      update public.giroa_coupons set used_count = used_count + 1 where code = p_coupon;
    end if;

    return jsonb_build_object('previous_preapproval_id', v_previous, 'changed', true);
  end if;

  -- Eventos de una suscripción vieja (reemplazada) no afectan a la actual.
  if v_sub.mp_preapproval_id is distinct from p_preapproval_id then
    return jsonb_build_object('previous_preapproval_id', null, 'changed', false);
  end if;

  if p_status = 'cancelled' then
    update public.studio_subscriptions set status = 'cancelled', cancelled_at = now() where studio_id = p_studio_id;
  elsif p_status = 'paused' then
    update public.studio_subscriptions set status = 'past_due', grace_until = coalesce(grace_until, now() + interval '7 days')
    where studio_id = p_studio_id;
  end if;
  return jsonb_build_object('previous_preapproval_id', null, 'changed', true);
end;
$$;

-- Aplica el resultado de un cobro mensual/anual de la suscripción.
create function public.giroa_apply_subscription_charge(
  p_preapproval_id text,
  p_approved boolean,
  p_next_payment_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  if p_approved then
    update public.studio_subscriptions set
      status = 'active',
      last_payment_at = now(),
      grace_until = null,
      current_period_end = coalesce(p_next_payment_at, current_period_end)
    where mp_preapproval_id = p_preapproval_id;
  else
    update public.studio_subscriptions set
      status = 'past_due',
      grace_until = coalesce(grace_until, now() + interval '7 days')
    where mp_preapproval_id = p_preapproval_id and status <> 'cancelled';
  end if;
end;
$$;

revoke execute on function public.studio_access(uuid) from public, anon, authenticated;
revoke execute on function public.choose_trial_plan(uuid, public.studio_plan) from public, anon, authenticated;
revoke execute on function public.giroa_quote(public.studio_plan, public.billing_cycle, text) from public, anon, authenticated;
revoke execute on function public.giroa_apply_preapproval(uuid, text, text, public.studio_plan, public.billing_cycle, bigint, smallint, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.giroa_apply_subscription_charge(text, boolean, timestamptz) from public, anon, authenticated;

grant execute on function public.studio_access(uuid) to authenticated, service_role;
grant execute on function public.choose_trial_plan(uuid, public.studio_plan) to authenticated, service_role;
grant execute on function public.giroa_quote(public.studio_plan, public.billing_cycle, text) to authenticated, service_role;
grant execute on function public.giroa_apply_preapproval(uuid, text, text, public.studio_plan, public.billing_cycle, bigint, smallint, text, timestamptz) to service_role;
grant execute on function public.giroa_apply_subscription_charge(text, boolean, timestamptz) to service_role;
