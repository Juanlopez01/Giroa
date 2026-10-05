-- =============================================================================
-- Outbox de notificaciones. Las RPC y los crons encolan; un worker del
-- servidor (service role) las envía. Hoy: email (proveedor a definir).
-- Mañana: WhatsApp es otro valor de channel sobre la misma tabla.
-- =============================================================================

create table public.notifications (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios (id) on delete cascade,
  student_id uuid,
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  template text not null check (template ~ '^[a-z][a-z0-9_]{1,60}$'),
  to_address text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  send_after timestamptz not null default now(),
  attempts smallint not null default 0,
  last_error text,
  sent_at timestamptz,
  -- Evita mandar dos veces el mismo aviso (p. ej. 'pack_expiring:<pack_id>').
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete cascade
);

create index notifications_pending_idx on public.notifications (send_after) where status = 'pending';

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

create function private.enqueue_notification(
  p_studio_id uuid,
  p_student_id uuid,
  p_template text,
  p_payload jsonb default '{}'::jsonb,
  p_send_after timestamptz default now(),
  p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select s.email into v_email
  from public.students s
  where s.id = p_student_id and s.studio_id = p_studio_id;

  insert into public.notifications (studio_id, student_id, template, to_address, payload, send_after, dedupe_key, status)
  values (
    p_studio_id, p_student_id, p_template, v_email, coalesce(p_payload, '{}'::jsonb), p_send_after, p_dedupe_key,
    case when v_email is null then 'skipped' else 'pending' end
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function private.enqueue_notification(uuid, uuid, text, jsonb, timestamptz, text)
  from public, anon, authenticated;
