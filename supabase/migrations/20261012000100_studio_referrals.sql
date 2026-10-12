-- =============================================================================
-- Recomendaciones entre estudios: "Recomendá Giroa".
--
-- Cada estudio tiene un link a la landing con ?desde=<slug> (también lo lleva el
-- "Hecho con Giroa" de sus páginas públicas). Si otro estudio se registra desde
-- ese link, queda anotado (claim_studio_referral). Cuando el estudio nuevo paga
-- su primera cuota de Giroa, el que lo recomendó suma 10% de descuento en su
-- suscripción, hasta 25% en total. Es de por vida y se suma al de fundador.
--
-- La base no habla con Mercado Pago: el webhook pide el precio nuevo
-- (giroa_reprice), cambia el monto del débito en MP y lo guarda
-- (giroa_set_subscription_price).
-- =============================================================================

create table public.studio_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_studio_id uuid not null references public.studios (id) on delete cascade,
  referred_studio_id uuid not null unique references public.studios (id) on delete cascade,
  status public.referral_status not null default 'pending',
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_studio_id <> referred_studio_id)
);
create index studio_referrals_referrer_idx on public.studio_referrals (referrer_studio_id);

-- Es de Giroa, no de un estudio: sin políticas, se lee con studio_referral_summary.
alter table public.studio_referrals enable row level security;
revoke all on public.studio_referrals from anon, authenticated;

alter table public.studio_subscriptions
  add column referral_discount_pct smallint not null default 0 check (referral_discount_pct between 0 and 25);

-- Descuento por recomendar: 10% por estudio que ya pagó, hasta 25%.
create function private.studio_referral_discount(p_studio_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select least(25, 10 * count(*))::smallint
  from public.studio_referrals
  where referrer_studio_id = p_studio_id and status = 'rewarded'
$$;
revoke execute on function private.studio_referral_discount(uuid) from public, anon, authenticated;

-- Precio de un plan con un descuento. Anual: 2 meses gratis (se pagan 10).
create function private.giroa_price(p_plan public.studio_plan, p_cycle public.billing_cycle, p_discount_pct integer)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    (case when p_cycle = 'annual' then p.monthly_price_cents * 10 else p.monthly_price_cents end)
    * (100 - least(greatest(p_discount_pct, 0), 100)) / 100.0
  )::bigint
  from public.plans p
  where p.key = p_plan
$$;
revoke execute on function private.giroa_price(public.studio_plan, public.billing_cycle, integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- El estudio nuevo anota quién lo recomendó. Solo el owner, solo si el estudio
-- es nuevo de verdad (7 días, todavía en prueba) y si no es un estudio propio.
-- Un link inválido no frena el alta: devuelve false.
-- -----------------------------------------------------------------------------
create function public.claim_studio_referral(p_studio_id uuid, p_referrer_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer uuid;
begin
  if not exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio_id and m.user_id = auth.uid() and m.role = 'owner'
  ) then
    perform private.fail('No tenés permiso para hacer esto.', 'forbidden');
  end if;

  if not exists (
    select 1 from public.studios s
    join public.studio_subscriptions sub on sub.studio_id = s.id
    where s.id = p_studio_id and s.created_at >= now() - interval '7 days'
      and sub.status = 'trialing' and sub.mp_preapproval_id is null
  ) then
    return false;
  end if;

  select s.id into v_referrer from public.studios s
  where s.slug = lower(btrim(p_referrer_slug)) and s.id <> p_studio_id;
  if v_referrer is null then
    return false;
  end if;

  -- Recomendarse a sí mismo (otro estudio propio o del que es parte) no cuenta.
  if exists (select 1 from public.studio_members m where m.studio_id = v_referrer and m.user_id = auth.uid()) then
    return false;
  end if;

  insert into public.studio_referrals (referrer_studio_id, referred_studio_id)
  values (v_referrer, p_studio_id)
  on conflict (referred_studio_id) do nothing;
  return found;
end;
$$;

-- Lo que ve el estudio en "Tu plan": a cuántos recomendó y cuánto descuento suma.
create function public.studio_referral_summary(p_studio_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('No tenés permiso para ver esta información.', 'forbidden');
  end if;

  return jsonb_build_object(
    'pending', (select count(*) from public.studio_referrals where referrer_studio_id = p_studio_id and status = 'pending'),
    'rewarded', (select count(*) from public.studio_referrals where referrer_studio_id = p_studio_id and status = 'rewarded'),
    'discount_pct', private.studio_referral_discount(p_studio_id),
    'step_pct', 10,
    'max_pct', 25
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- giroa_quote suma el descuento por recomendar del estudio que se suscribe.
-- -----------------------------------------------------------------------------
drop function public.giroa_quote(public.studio_plan, public.billing_cycle, text);

create function public.giroa_quote(
  p_plan public.studio_plan,
  p_cycle public.billing_cycle,
  p_coupon text default null,
  p_studio_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_monthly bigint;
  v_coupon public.giroa_coupons%rowtype;
  v_code text := nullif(upper(btrim(p_coupon)), '');
  v_plan_name text;
  v_founder smallint;
  v_referral smallint := 0;
begin
  select monthly_price_cents into v_monthly from public.plans where key = p_plan;
  if v_monthly is null then
    perform private.fail('Ese plan no existe.', 'plan_not_found');
  end if;

  if p_studio_id is not null then
    if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
      perform private.fail('No tenés permiso para ver esta información.', 'forbidden');
    end if;
    v_referral := private.studio_referral_discount(p_studio_id);
  end if;

  if v_code is not null then
    select * into v_coupon from public.giroa_coupons c
    where c.code = v_code and c.is_active and (c.max_uses is null or c.used_count < c.max_uses);
    if not found then
      perform private.fail('Ese código no es válido o ya se usó todas las veces.', 'invalid_coupon');
    end if;
    if v_coupon.plan is not null and v_coupon.plan <> p_plan then
      select name into v_plan_name from public.plans where key = v_coupon.plan;
      perform private.fail(format('Este código es para el plan %s.', v_plan_name), 'invalid_coupon');
    end if;
  else
    select * into v_coupon from public.giroa_coupons c
    where c.auto and c.is_active and c.plan = p_plan and (c.max_uses is null or c.used_count < c.max_uses)
    order by c.discount_pct desc
    limit 1;
  end if;
  v_founder := coalesce(v_coupon.discount_pct, 0);

  return jsonb_build_object(
    'plan', p_plan,
    'cycle', p_cycle,
    'base_cents', private.giroa_price(p_plan, p_cycle, 0),
    'discount_pct', v_founder + v_referral,
    'coupon_pct', v_founder,
    'referral_pct', v_referral,
    'amount_cents', private.giroa_price(p_plan, p_cycle, v_founder + v_referral),
    'coupon', v_coupon.code,
    'founder', coalesce(v_coupon.auto, false)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Cobro de la suscripción: el primer cobro aprobado de un estudio recomendado
-- premia al que lo recomendó. Devuelve el estudio a re-precificar.
-- -----------------------------------------------------------------------------
drop function public.giroa_apply_subscription_charge(text, boolean, timestamptz);

create function public.giroa_apply_subscription_charge(
  p_preapproval_id text,
  p_approved boolean,
  p_next_payment_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio uuid;
  v_referrer uuid;
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
    where mp_preapproval_id = p_preapproval_id
    returning studio_id into v_studio;

    if v_studio is not null then
      update public.studio_referrals set status = 'rewarded', rewarded_at = now()
      where referred_studio_id = v_studio and status = 'pending';
      -- También en un webhook repetido: el re-precio es idempotente.
      select referrer_studio_id into v_referrer from public.studio_referrals
      where referred_studio_id = v_studio and status = 'rewarded';
    end if;
  else
    update public.studio_subscriptions set
      status = 'past_due',
      grace_until = coalesce(grace_until, now() + interval '7 days')
    where mp_preapproval_id = p_preapproval_id and status <> 'cancelled'
    returning studio_id into v_studio;
  end if;

  return jsonb_build_object('studio_id', v_studio, 'referrer_studio_id', v_referrer);
end;
$$;

-- -----------------------------------------------------------------------------
-- Solo servidor: precio que corresponde hoy a una suscripción activa con su
-- descuento por recomendar, y guardar el precio después de cambiarlo en MP.
-- -----------------------------------------------------------------------------
create function public.giroa_reprice(p_studio_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.studio_subscriptions%rowtype;
  v_referral smallint;
begin
  if not private.is_privileged() then
    perform private.fail('No autorizado.', 'forbidden');
  end if;

  select * into v_sub from public.studio_subscriptions where studio_id = p_studio_id;
  if not found or v_sub.mp_preapproval_id is null or v_sub.status not in ('active', 'past_due')
     or v_sub.plan is null or v_sub.billing_cycle is null then
    return jsonb_build_object('changed', false);
  end if;

  v_referral := private.studio_referral_discount(p_studio_id);
  return jsonb_build_object(
    'changed', v_referral <> v_sub.referral_discount_pct,
    'preapproval_id', v_sub.mp_preapproval_id,
    'referral_pct', v_referral,
    'amount_cents', private.giroa_price(v_sub.plan, v_sub.billing_cycle, v_sub.founder_discount_pct + v_referral)
  );
end;
$$;

create function public.giroa_set_subscription_price(
  p_studio_id uuid,
  p_preapproval_id text,
  p_amount_cents bigint,
  p_referral_pct smallint
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

  update public.studio_subscriptions set
    amount_cents = p_amount_cents,
    referral_discount_pct = least(greatest(coalesce(p_referral_pct, 0), 0), 25),
    discount_pct = least(founder_discount_pct + least(greatest(coalesce(p_referral_pct, 0), 0), 25), 100)
  where studio_id = p_studio_id and mp_preapproval_id = p_preapproval_id;
end;
$$;

revoke execute on function public.claim_studio_referral(uuid, text) from public, anon, authenticated;
revoke execute on function public.studio_referral_summary(uuid) from public, anon, authenticated;
revoke execute on function public.giroa_quote(public.studio_plan, public.billing_cycle, text, uuid) from public, anon, authenticated;
revoke execute on function public.giroa_apply_subscription_charge(text, boolean, timestamptz) from public, anon, authenticated;
revoke execute on function public.giroa_reprice(uuid) from public, anon, authenticated;
revoke execute on function public.giroa_set_subscription_price(uuid, text, bigint, smallint) from public, anon, authenticated;

grant execute on function public.claim_studio_referral(uuid, text) to authenticated;
grant execute on function public.studio_referral_summary(uuid) to authenticated, service_role;
grant execute on function public.giroa_quote(public.studio_plan, public.billing_cycle, text, uuid) to authenticated, service_role;
grant execute on function public.giroa_apply_subscription_charge(text, boolean, timestamptz) to service_role;
grant execute on function public.giroa_reprice(uuid) to service_role;
grant execute on function public.giroa_set_subscription_price(uuid, text, bigint, smallint) to service_role;
