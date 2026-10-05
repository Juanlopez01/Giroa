-- =============================================================================
-- Base: esquema privado, enums y utilidades compartidas.
--
-- Convenciones (ver CLAUDE.md):
--   * Toda tabla de negocio lleva studio_id y RLS activado.
--   * Plata siempre en centavos (bigint).
--   * Las funciones security definer usan search_path = '' y nombres calificados.
--   * El esquema "private" no se expone por la API: helpers e internos.
--   * Errores de negocio: raise exception con message en español (para mostrar)
--     y hint con un código estable (para el código), p. ej. hint = 'no_credits'.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
-- private no está en los esquemas expuestos por la API, así que nadie puede
-- llamar sus funciones desde afuera. Los roles de la API necesitan usage porque
-- las políticas RLS, triggers y checks llaman helpers de acá.
grant usage on schema private to anon, authenticated, service_role;

-- En public (expuesto por la API) ninguna función es ejecutable salvo grant
-- explícito: cada RPC declara quién la puede llamar.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.studio_plan as enum ('profe', 'inicial', 'estudio', 'pro');
create type public.member_role as enum ('owner', 'admin', 'teacher');
create type public.dance_role as enum ('leader', 'follower');
create type public.offering_kind as enum ('regular', 'special', 'formation');
create type public.session_status as enum ('scheduled', 'cancelled');
create type public.payment_method as enum ('mercadopago', 'cash', 'transfer');
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'refunded', 'cancelled');
create type public.payment_purpose as enum ('pack');
create type public.pack_status as enum ('active', 'frozen', 'expired', 'cancelled');
create type public.booking_status as enum ('booked', 'attended', 'cancelled', 'no_show');
create type public.credit_event_kind as enum ('grant', 'consume', 'refund', 'adjust', 'expire');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');
create type public.billing_cycle as enum ('monthly', 'annual');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Rol del request según el JWT. Sin JWT (pg_cron, migraciones, psql) => 'internal'.
create function private.request_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'internal'
  )
$$;

-- true para service role (servidor) y procesos internos (cron).
create function private.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.request_role() in ('service_role', 'internal')
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Error de negocio con mensaje humano + código estable en hint.
create function private.fail(p_message text, p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_message, hint = p_code;
end;
$$;
