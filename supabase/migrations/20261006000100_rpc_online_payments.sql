-- =============================================================================
-- ¿El estudio cobra online? (plan con mp_checkout + Mercado Pago vinculado).
-- Solo devuelve true/false: mp_connections sigue sin políticas RLS.
-- =============================================================================

create function public.studio_accepts_online_payments(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.studio_has_feature(p_studio_id, 'mp_checkout')
     and exists (select 1 from public.mp_connections c where c.studio_id = p_studio_id)
$$;

revoke execute on function public.studio_accepts_online_payments(uuid) from public, anon, authenticated;
grant execute on function public.studio_accepts_online_payments(uuid) to anon, authenticated, service_role;
