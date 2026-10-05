-- =============================================================================
-- Vistas con security_invoker: respetan el RLS de las tablas de base.
-- (La grilla pública con cupos usa list_public_sessions, porque un anónimo no
-- puede leer reservas ajenas ni siquiera para contarlas.)
-- =============================================================================

-- Saldo del alumno: "te quedan 3 clases, vence el 12/11".
create view public.student_balances
with (security_invoker = true)
as
select
  sp.id as student_pack_id,
  sp.studio_id,
  sp.student_id,
  sp.partner_student_id,
  sp.name,
  sp.credits_total,
  sp.credits_used,
  case when sp.credits_total is null then null
       else sp.credits_total - sp.credits_used end as credits_remaining,
  sp.starts_at,
  sp.expires_at,
  -- Último día válido en la hora local del estudio.
  ((sp.expires_at - interval '1 second') at time zone st.timezone)::date as expires_on,
  sp.status,
  (sp.status = 'active'
    and sp.expires_at > now()
    and (sp.credits_total is null or sp.credits_used < sp.credits_total)) as is_usable
from public.student_packs sp
join public.studios st on st.id = sp.studio_id;

-- Ocupación por sesión con conteo por rol (panel del staff).
create view public.session_occupancy
with (security_invoker = true)
as
select
  s.id as session_id,
  s.studio_id,
  s.offering_id,
  s.starts_at,
  s.ends_at,
  s.status,
  coalesce(s.capacity_override, o.capacity) as capacity,
  count(b.id) filter (where b.status in ('booked', 'attended'))::integer as booked_count,
  count(b.id) filter (where b.status = 'attended')::integer as attended_count,
  count(b.id) filter (where b.status in ('booked', 'attended') and b.dance_role = 'leader')::integer as leader_count,
  count(b.id) filter (where b.status in ('booked', 'attended') and b.dance_role = 'follower')::integer as follower_count
from public.sessions s
join public.offerings o on o.id = s.offering_id
left join public.bookings b on b.session_id = s.id
group by s.id, o.capacity;

revoke all on public.student_balances, public.session_occupancy from anon, authenticated;
grant select on public.student_balances, public.session_occupancy to authenticated;
