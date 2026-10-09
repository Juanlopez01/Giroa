-- =============================================================================
-- Oferta fundadores: los primeros 10 de cada plan (Profe, Inicial, Estudio)
-- pagan el 50% de por vida.
--
-- giroa_coupons.plan: el código vale solo para ese plan (null = cualquiera).
-- giroa_coupons.auto: se aplica solo, sin escribirlo, mientras queden usos.
-- El uso se cuenta cuando MP autoriza el débito (giroa_apply_preapproval), y el
-- descuento queda guardado en la suscripción: es de por vida mientras siga.
-- =============================================================================

alter table public.giroa_coupons
  add column plan public.studio_plan,
  add column auto boolean not null default false;

-- Nadie usó FUNDADOR (era un cupo de 10 compartido): se reemplaza por uno por plan.
update public.giroa_coupons set is_active = false where code = 'FUNDADOR' and used_count = 0;
insert into public.giroa_coupons (code, discount_pct, max_uses, plan, auto) values
  ('FUNDADOR-PROFE', 50, 10, 'profe', true),
  ('FUNDADOR-INICIAL', 50, 10, 'inicial', true),
  ('FUNDADOR-ESTUDIO', 50, 10, 'estudio', true)
on conflict (code) do nothing;

-- Precio de una suscripción. Sin código, se aplica el de fundador del plan si quedan lugares.
create or replace function public.giroa_quote(p_plan public.studio_plan, p_cycle public.billing_cycle, p_coupon text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_monthly bigint;
  v_discount smallint;
  v_coupon public.giroa_coupons%rowtype;
  v_code text := nullif(upper(btrim(p_coupon)), '');
  v_base bigint;
  v_plan_name text;
begin
  select monthly_price_cents into v_monthly from public.plans where key = p_plan;
  if v_monthly is null then
    perform private.fail('Ese plan no existe.', 'plan_not_found');
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
  v_discount := coalesce(v_coupon.discount_pct, 0);

  -- Anual: 2 meses gratis (se pagan 10).
  v_base := case when p_cycle = 'annual' then v_monthly * 10 else v_monthly end;
  return jsonb_build_object(
    'plan', p_plan,
    'cycle', p_cycle,
    'base_cents', v_base,
    'discount_pct', v_discount,
    'amount_cents', round(v_base * (100 - v_discount) / 100.0)::bigint,
    'coupon', v_coupon.code,
    'founder', coalesce(v_coupon.auto, false)
  );
end;
$$;

-- Lugares de fundador que quedan por plan (landing y Tu plan). Público.
create function public.giroa_founder_spots()
returns table (plan public.studio_plan, discount_pct smallint, spots_left integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.plan, c.discount_pct, greatest(c.max_uses - c.used_count, 0)
  from public.giroa_coupons c
  where c.auto and c.is_active and c.plan is not null and c.max_uses is not null
$$;

revoke execute on function public.giroa_founder_spots() from public, anon, authenticated;
grant execute on function public.giroa_founder_spots() to anon, authenticated, service_role;
