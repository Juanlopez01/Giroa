-- =============================================================================
-- Referidos (feature 'referrals', Estudio y Pro): "Invitá a un amigo".
--
-- Cada alumno tiene un código (students.referral_code). El amigo se suma con el
-- link …/sumate?ref=<código> y queda anotado (claim_referral). Cuando paga su
-- primer pack (cualquier pago de pack aprobado), los dos reciben un pack de
-- regalo con studios.referral_credits clases (0 = apagado), válido 60 días.
-- =============================================================================

create function private.referral_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- Sin letras que se confunden (0/O, 1/I/L).
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from extensions.gen_random_bytes(6) b, generate_series(0, 5) i
$$;
revoke execute on function private.referral_code() from public, anon, authenticated;

alter table public.students add column referral_code text;
update public.students set referral_code = private.referral_code() where referral_code is null;
alter table public.students
  alter column referral_code set default '', -- lo completa el trigger
  alter column referral_code set not null,
  add constraint students_referral_code_key unique (studio_id, referral_code);

-- Con trigger (no default): el staff inserta alumnos directo y no ve el esquema private.
create function private.set_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if coalesce(new.referral_code, '') = '' then
    new.referral_code := private.referral_code();
  end if;
  return new;
end;
$fn$;
revoke execute on function private.set_referral_code() from public, anon, authenticated;
create trigger students_referral_code before insert on public.students
  for each row execute function private.set_referral_code();

alter table public.studios
  add column referral_credits smallint not null default 1 check (referral_credits between 0 and 10);
grant update (referral_credits) on public.studios to authenticated;

create type public.referral_status as enum ('pending', 'rewarded', 'void');

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  referrer_student_id uuid not null,
  referred_student_id uuid not null,
  status public.referral_status not null default 'pending',
  credits smallint, -- las que se dieron a cada uno
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (studio_id, id),
  unique (referred_student_id),
  check (referrer_student_id <> referred_student_id),
  foreign key (studio_id, referrer_student_id) references public.students (studio_id, id) on delete cascade,
  foreign key (studio_id, referred_student_id) references public.students (studio_id, id) on delete cascade
);
create index referrals_referrer_idx on public.referrals (referrer_student_id);

alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;
create policy referrals_read on public.referrals for select to authenticated
  using (
    private.is_studio_admin(studio_id)
    or referrer_student_id in (select private.my_student_ids())
    or referred_student_id in (select private.my_student_ids())
  );

-- -----------------------------------------------------------------------------
-- El alumno nuevo anota quién lo invitó. Solo si es nuevo de verdad: se sumó en
-- los últimos 7 días y todavía no pagó ningún pack. Un código inválido no
-- frena el alta: devuelve false.
-- -----------------------------------------------------------------------------
create function public.claim_referral(p_studio_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.students%rowtype;
  v_referrer uuid;
begin
  if not public.studio_has_feature(p_studio_id, 'referrals') then
    return false;
  end if;

  select * into v_me from public.students where studio_id = p_studio_id and user_id = auth.uid();
  if not found or v_me.created_at < now() - interval '7 days' then
    return false;
  end if;
  if exists (select 1 from public.payments where student_id = v_me.id and status = 'approved') then
    return false;
  end if;

  select id into v_referrer from public.students
  where studio_id = p_studio_id and referral_code = upper(btrim(p_code)) and id <> v_me.id;
  if v_referrer is null then
    return false;
  end if;

  insert into public.referrals (studio_id, referrer_student_id, referred_student_id)
  values (p_studio_id, v_referrer, v_me.id)
  on conflict (referred_student_id) do nothing;
  return found;
end;
$$;

-- Pack de regalo (sin producto ni pago), con su historial y aviso.
create function private.grant_gift_credits(p_studio_id uuid, p_student_id uuid, p_name text, p_credits integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_pack uuid;
  v_expires timestamptz;
begin
  select timezone into v_tz from public.studios where id = p_studio_id;
  v_expires := private.pack_expires_at(v_tz, now(), 60);
  insert into public.student_packs (studio_id, student_id, name, credits_total, expires_at)
  values (p_studio_id, p_student_id, p_name, p_credits, v_expires)
  returning id into v_pack;
  insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note)
  values (p_studio_id, v_pack, 'grant', p_credits, 'Regalo por referido');
  perform private.enqueue_notification(
    p_studio_id, p_student_id, 'pack_granted',
    jsonb_build_object('student_pack_id', v_pack, 'name', p_name, 'credits', p_credits, 'expires_at', v_expires),
    now(), 'pack_granted:' || v_pack
  );
  return v_pack;
end;
$$;
revoke execute on function private.grant_gift_credits(uuid, uuid, text, integer) from public, anon, authenticated;

-- Primer pago de pack aprobado del invitado → regalo para los dos.
create function private.reward_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref public.referrals%rowtype;
  v_credits smallint;
  v_referred_name text;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;

  select * into v_ref from public.referrals
  where referred_student_id = new.student_id and status = 'pending'
  for update;
  if not found then
    return new;
  end if;

  select referral_credits into v_credits from public.studios where id = new.studio_id;
  if coalesce(v_credits, 0) = 0 or not public.studio_has_feature(new.studio_id, 'referrals') then
    return new; -- queda pendiente por si el estudio lo vuelve a prender
  end if;

  select full_name into v_referred_name from public.students where id = new.student_id;
  perform private.grant_gift_credits(new.studio_id, v_ref.referred_student_id, 'Regalo de bienvenida', v_credits);
  perform private.grant_gift_credits(new.studio_id, v_ref.referrer_student_id,
    left('Regalo por invitar a ' || split_part(v_referred_name, ' ', 1), 80), v_credits);

  update public.referrals set status = 'rewarded', credits = v_credits, rewarded_at = now() where id = v_ref.id;
  return new;
end;
$$;
revoke execute on function private.reward_referral() from public, anon, authenticated;

create trigger payments_reward_referral after insert or update of status on public.payments
  for each row when (new.status = 'approved' and new.purpose = 'pack')
  execute function private.reward_referral();

revoke execute on function public.claim_referral(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_referral(uuid, text) to authenticated;
