-- =============================================================================
-- Fundadores también en Pro (se abrió con liquidación de profes y certificados):
-- los primeros 10 pagan el 50% de por vida, igual que en los otros planes.
-- Se aplica solo al suscribirse (auto) y lo muestran la landing y Tu plan.
-- =============================================================================

insert into public.giroa_coupons (code, discount_pct, max_uses, plan, auto)
values ('FUNDADOR-PRO', 50, 10, 'pro', true)
on conflict (code) do nothing;
