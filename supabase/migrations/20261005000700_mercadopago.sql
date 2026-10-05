-- =============================================================================
-- Mercado Pago. Estas tablas NO tienen políticas RLS: solo las toca el
-- service role desde el servidor. Los tokens se guardan encriptados con
-- AES-256-GCM (src/lib/crypto) antes de llegar acá.
-- =============================================================================

create table public.mp_connections (
  studio_id uuid primary key references public.studios (id) on delete cascade,
  mp_user_id text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  public_key text,
  live_mode boolean not null default true,
  scope text,
  expires_at timestamptz not null,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mp_connections_updated_at before update on public.mp_connections
  for each row execute function private.set_updated_at();

-- Registro de webhooks recibidos (auditoría + deduplicación por x-request-id).
create table public.mp_webhook_events (
  id bigint generated always as identity primary key,
  studio_id uuid references public.studios (id) on delete set null,
  request_id text,
  topic text not null,
  resource_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (request_id)
);

create index mp_webhook_events_resource_idx on public.mp_webhook_events (topic, resource_id);

alter table public.mp_connections enable row level security;
alter table public.mp_webhook_events enable row level security;
revoke all on public.mp_connections, public.mp_webhook_events from anon, authenticated;
