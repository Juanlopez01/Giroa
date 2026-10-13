-- =============================================================================
-- Liquidación de profes (feature 'teacher_payouts', plan Pro).
--
-- Reglas por clase (payout_rules): una clase puede tener varios profes (en
-- tango es común que la den de a dos), con o sin cuenta en Giroa. Cada regla:
-- fijo por clase, por alumno presente o % de lo que generó la clase.
--
-- Lo que generó cada clase lo calcula payout_sessions: cada lugar usado
-- (presentes y ausentes: esa plata ya entró) vale lo que pagó el alumno por él
-- (pack: pago / clases; pack libre: pago / clases que usó con ese pack; clase
-- suelta o workshop: lo que pagó; clase de prueba o pack de regalo: 0).
-- Aplicar las reglas a esos números es puro TS (src/lib/payouts.ts).
--
-- Al marcar un pago (teacher_payouts) se guarda el detalle congelado: si
-- después cambian las reglas, lo pagado no cambia.
-- =============================================================================

create type public.payout_kind as enum ('per_class', 'per_student', 'percent');

create table public.payout_rules (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  offering_id uuid not null,
  payee_name text not null check (char_length(btrim(payee_name)) between 2 and 120),
  member_id uuid,
  kind public.payout_kind not null,
  amount_cents bigint check (amount_cents between 0 and 100000000000),
  percent numeric(5, 2) check (percent > 0 and percent <= 100),
  created_at timestamptz not null default now(),
  check ((kind = 'percent') = (percent is not null) and (kind = 'percent') = (amount_cents is null)),
  unique (studio_id, id),
  foreign key (studio_id, offering_id) references public.offerings (studio_id, id) on delete cascade,
  foreign key (studio_id, member_id) references public.studio_members (studio_id, id) on delete set null (member_id)
);

create index payout_rules_offering_idx on public.payout_rules (offering_id);

create table public.teacher_payouts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  -- Primer día del mes liquidado.
  period date not null check (extract(day from period) = 1),
  -- Identifica al profe: su member_id o su nombre normalizado (private.payee_key).
  payee_key text not null,
  payee_name text not null check (char_length(btrim(payee_name)) between 2 and 120),
  member_id uuid,
  amount_cents bigint not null check (amount_cents >= 0),
  -- Detalle por clase al momento de pagar (lo arma el panel).
  breakdown jsonb not null default '[]'::jsonb,
  method public.payment_method not null check (method <> 'mercadopago'),
  note text check (char_length(note) <= 500),
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users (id) on delete set null,
  unique (studio_id, period, payee_key),
  unique (studio_id, id),
  foreign key (studio_id, member_id) references public.studio_members (studio_id, id) on delete set null (member_id)
);

create index teacher_payouts_member_idx on public.teacher_payouts (member_id) where member_id is not null;

-- El profe es el mismo en todas sus clases: por su cuenta o por su nombre.
create function private.payee_key(p_member_id uuid, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_member_id::text, 'n:' || lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g')))
$$;

revoke execute on function private.payee_key(uuid, text) from public, anon;
grant execute on function private.payee_key(uuid, text) to authenticated, service_role;

-- Los member_id del usuario actual (un profe ve solo lo suyo).
create function private.my_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.studio_members where user_id = auth.uid()
$$;

revoke execute on function private.my_member_ids() from public, anon;
grant execute on function private.my_member_ids() to authenticated, service_role;

alter table public.payout_rules enable row level security;
alter table public.teacher_payouts enable row level security;
revoke all on public.payout_rules, public.teacher_payouts from anon, authenticated;
grant select on public.payout_rules, public.teacher_payouts to authenticated;

create policy payout_rules_read on public.payout_rules for select to authenticated
  using (private.is_studio_admin(studio_id) or member_id in (select private.my_member_ids()));
create policy teacher_payouts_read on public.teacher_payouts for select to authenticated
  using (private.is_studio_admin(studio_id) or member_id in (select private.my_member_ids()));

-- -----------------------------------------------------------------------------
-- Reglas de una clase: reemplaza todas las de esa clase (dueño o encargado).
-- p_rules: [{ "payee_name", "member_id"?, "kind", "amount_cents"?, "percent"? }]
-- -----------------------------------------------------------------------------
create function public.set_payout_rules(p_offering_id uuid, p_rules jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio uuid;
  v_rule jsonb;
  v_kind public.payout_kind;
  v_percent_total numeric := 0;
  v_count integer := 0;
begin
  select studio_id into v_studio from public.offerings where id = p_offering_id;
  if v_studio is null or not private.is_studio_admin(v_studio) then
    perform private.fail('No encontramos esa clase.', 'offering_not_found');
  end if;
  if not public.studio_has_feature(v_studio, 'teacher_payouts') then
    perform private.fail('La liquidación de profes está en el plan Pro.', 'feature_unavailable');
  end if;
  if jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_rules, '[]'::jsonb)) > 10 then
    perform private.fail('Podés cargar hasta 10 profes por clase.', 'invalid_rules');
  end if;

  delete from public.payout_rules where offering_id = p_offering_id;

  for v_rule in select * from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) loop
    begin
      v_kind := (v_rule ->> 'kind')::public.payout_kind;
    exception when others then
      perform private.fail('Elegí cómo se le paga a cada profe.', 'invalid_rules');
    end;
    if v_kind = 'percent' then
      v_percent_total := v_percent_total + coalesce((v_rule ->> 'percent')::numeric, 0);
    end if;
    if char_length(btrim(coalesce(v_rule ->> 'payee_name', ''))) < 2 then
      perform private.fail('Poné el nombre de cada profe.', 'invalid_rules');
    end if;
    if (v_rule ->> 'member_id') is not null and not exists (
      select 1 from public.studio_members where id = (v_rule ->> 'member_id')::uuid and studio_id = v_studio
    ) then
      perform private.fail('Ese profe no es del equipo del estudio.', 'invalid_rules');
    end if;

    insert into public.payout_rules (studio_id, offering_id, payee_name, member_id, kind, amount_cents, percent)
    values (
      v_studio, p_offering_id, btrim(v_rule ->> 'payee_name'), (v_rule ->> 'member_id')::uuid, v_kind,
      case when v_kind <> 'percent' then (v_rule ->> 'amount_cents')::bigint end,
      case when v_kind = 'percent' then (v_rule ->> 'percent')::numeric end
    );
    v_count := v_count + 1;
  end loop;

  if v_percent_total > 100 then
    perform private.fail('Entre todos los profes no pueden llevarse más del 100% de la clase.', 'invalid_rules');
  end if;
  return v_count;
exception
  when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
    perform private.fail('Revisá los montos: tienen que ser números positivos (y el % hasta 100).', 'invalid_rules');
end;
$$;

revoke execute on function public.set_payout_rules(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_payout_rules(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Números de cada clase dictada en el período [p_from, p_to): presentes, lugares
-- usados y lo que generó. El dueño/encargado ve todas; un profe, las clases en
-- las que tiene una regla a su nombre.
-- -----------------------------------------------------------------------------
create function public.payout_sessions(p_studio_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  session_id uuid,
  offering_id uuid,
  title text,
  starts_at timestamptz,
  present integer,
  used integer,
  revenue_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := private.is_studio_admin(p_studio_id);
begin
  if not v_admin and not exists (
    select 1 from public.payout_rules r where r.studio_id = p_studio_id and r.member_id in (select private.my_member_ids())
  ) then
    perform private.fail('No tenés acceso a las liquidaciones de este estudio.', 'forbidden');
  end if;
  if p_to <= p_from or p_to - p_from > interval '93 days' then
    perform private.fail('Elegí un período de hasta 3 meses.', 'invalid_period');
  end if;

  return query
  with s as (
    select se.id, se.offering_id, o.title, se.starts_at
    from public.sessions se
    join public.offerings o on o.id = se.offering_id
    where se.studio_id = p_studio_id and se.status = 'scheduled'
      and se.starts_at >= p_from and se.starts_at < p_to and se.starts_at < now()
      and (v_admin or exists (
        select 1 from public.payout_rules r where r.offering_id = se.offering_id and r.member_id in (select private.my_member_ids())
      ))
  ),
  b as (
    select bk.id, bk.session_id, bk.status, bk.is_trial, bk.student_pack_id
    from public.bookings bk join s on s.id = bk.session_id
    where bk.status <> 'cancelled'
  ),
  -- Lo que se pagó por cada pack usado y entre cuántas clases se reparte.
  pv as (
    select sp.id,
      coalesce(
        (select p.amount_cents from public.payments p where p.id = sp.payment_id and p.status = 'approved'),
        (select g.amount_cents from public.gift_cards g where g.student_pack_id = sp.id),
        0
      ) as paid_cents,
      coalesce(nullif(sp.credits_total, 0), greatest(1, (
        select count(*) from public.bookings x where x.student_pack_id = sp.id and x.status <> 'cancelled'
      ))) as slots
    from public.student_packs sp
    where sp.id in (select student_pack_id from b where student_pack_id is not null)
  ),
  bv as (
    select b.session_id, b.status,
      case
        when cp.amount_cents is not null then cp.amount_cents
        when b.is_trial then 0
        when pv.id is not null then round(pv.paid_cents::numeric / pv.slots)::bigint
        else 0
      end as value_cents
    from b
    left join public.class_purchases cp on cp.booking_id = b.id and cp.status = 'paid'
    left join pv on pv.id = b.student_pack_id
  )
  select s.id, s.offering_id, s.title, s.starts_at,
    count(bv.*) filter (where bv.status = 'attended')::integer,
    count(bv.*)::integer,
    coalesce(sum(bv.value_cents), 0)::bigint
  from s left join bv on bv.session_id = s.id
  group by s.id, s.offering_id, s.title, s.starts_at
  order by s.starts_at;
end;
$$;

revoke execute on function public.payout_sessions(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.payout_sessions(uuid, timestamptz, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Marcar como pagada la liquidación de un profe en un mes (dueño o encargado).
-- El monto y el detalle los calcula el panel con las reglas vigentes.
-- -----------------------------------------------------------------------------
create function public.mark_payout_paid(
  p_studio_id uuid,
  p_period date,
  p_payee_name text,
  p_member_id uuid,
  p_amount_cents bigint,
  p_breakdown jsonb,
  p_method public.payment_method,
  p_note text default null
)
returns public.teacher_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.teacher_payouts%rowtype;
begin
  if not private.is_studio_admin(p_studio_id) then
    perform private.fail('Solo el dueño o un encargado marca los pagos a profes.', 'forbidden');
  end if;
  if not public.studio_has_feature(p_studio_id, 'teacher_payouts') then
    perform private.fail('La liquidación de profes está en el plan Pro.', 'feature_unavailable');
  end if;
  if p_method not in ('cash', 'transfer') then
    perform private.fail('Elegí si le pagaste en efectivo o por transferencia.', 'invalid_method');
  end if;
  if p_member_id is not null and not exists (select 1 from public.studio_members where id = p_member_id and studio_id = p_studio_id) then
    perform private.fail('Ese profe no es del equipo del estudio.', 'invalid_payee');
  end if;
  if exists (
    select 1 from public.teacher_payouts
    where studio_id = p_studio_id and period = date_trunc('month', p_period)::date and payee_key = private.payee_key(p_member_id, p_payee_name)
  ) then
    perform private.fail('Ese mes ya figura como pagado a este profe.', 'payout_already_paid');
  end if;

  insert into public.teacher_payouts (studio_id, period, payee_key, payee_name, member_id, amount_cents, breakdown, method, note, paid_by)
  values (
    p_studio_id, date_trunc('month', p_period)::date, private.payee_key(p_member_id, p_payee_name), btrim(p_payee_name),
    p_member_id, p_amount_cents, coalesce(p_breakdown, '[]'::jsonb), p_method, nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  )
  returning * into v_row;
  return v_row;
exception
  when check_violation then
    perform private.fail('Revisá el monto y el nombre del profe.', 'invalid_payout');
end;
$$;

revoke execute on function public.mark_payout_paid(uuid, date, text, uuid, bigint, jsonb, public.payment_method, text) from public, anon, authenticated;
grant execute on function public.mark_payout_paid(uuid, date, text, uuid, bigint, jsonb, public.payment_method, text) to authenticated;

-- Deshacer (se marcó por error).
create function public.undo_payout(p_payout_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio uuid;
begin
  select studio_id into v_studio from public.teacher_payouts where id = p_payout_id;
  if v_studio is null or not private.is_studio_admin(v_studio) then
    perform private.fail('No encontramos ese pago.', 'payout_not_found');
  end if;
  delete from public.teacher_payouts where id = p_payout_id;
  return true;
end;
$$;

revoke execute on function public.undo_payout(uuid) from public, anon, authenticated;
grant execute on function public.undo_payout(uuid) to authenticated;
