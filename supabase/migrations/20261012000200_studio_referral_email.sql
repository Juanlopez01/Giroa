-- =============================================================================
-- Recomendá Giroa: mail al dueño del estudio que recomendó cuando el estudio
-- recomendado paga su primera cuota (template giroa_referral_reward).
-- Va a la cola de avisos con el email de cada owner (sin alumno), como las
-- invitaciones al equipo. Un aviso por recomendación (dedupe_key).
-- =============================================================================

create or replace function public.giroa_apply_subscription_charge(
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
  v_rewarded public.studio_referrals%rowtype;
  v_before smallint;
  v_after smallint;
  v_subscribed boolean;
  v_referred_name text;
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
      select * into v_rewarded from public.studio_referrals
      where referred_studio_id = v_studio and status = 'pending'
      for update;

      if found then
        v_before := private.studio_referral_discount(v_rewarded.referrer_studio_id);
        update public.studio_referrals set status = 'rewarded', rewarded_at = now() where id = v_rewarded.id;
        v_after := private.studio_referral_discount(v_rewarded.referrer_studio_id);

        select name into v_referred_name from public.studios where id = v_studio;
        select sub.mp_preapproval_id is not null and sub.status in ('active', 'past_due') into v_subscribed
        from public.studio_subscriptions sub where sub.studio_id = v_rewarded.referrer_studio_id;

        insert into public.notifications (studio_id, template, to_address, payload, dedupe_key)
        select
          v_rewarded.referrer_studio_id, 'giroa_referral_reward', u.email,
          jsonb_build_object(
            'owner_name', m.display_name,
            'referred_name', v_referred_name,
            'gained_pct', v_after - v_before,
            'total_pct', v_after,
            'max_pct', 25,
            'subscribed', coalesce(v_subscribed, false)
          ),
          'giroa_referral_reward:' || v_rewarded.id || ':' || m.user_id
        from public.studio_members m
        join auth.users u on u.id = m.user_id
        where m.studio_id = v_rewarded.referrer_studio_id and m.role = 'owner' and u.email is not null
        on conflict (dedupe_key) do nothing;
      end if;

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
