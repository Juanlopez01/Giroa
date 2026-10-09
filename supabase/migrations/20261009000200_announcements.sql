-- =============================================================================
-- Anuncios a los alumnos (feature 'announcements', planes Estudio y Pro):
-- "Mañana no hay clase por el feriado". Se muestran como cartel en el Inicio de
-- la app (cada alumno lo cierra) y, si el estudio quiere, salen por mail.
-- Destinatarios: todos los alumnos activos, los de una clase (que la reservaron
-- en los últimos 30 días o tienen reserva futura) o los de una formación.
-- =============================================================================

insert into public.plan_features (plan, feature) values ('estudio', 'announcements'), ('pro', 'announcements')
on conflict do nothing;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  audience text not null check (audience in ('all', 'offering', 'formation')),
  offering_id uuid,
  formation_id uuid,
  visible_until timestamptz,
  send_email boolean not null default true,
  emailed_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((audience = 'offering') = (offering_id is not null)),
  check ((audience = 'formation') = (formation_id is not null)),
  unique (studio_id, id),
  foreign key (studio_id, offering_id) references public.offerings (studio_id, id) on delete cascade,
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade
);

create index announcements_studio_idx on public.announcements (studio_id, created_at desc);

create table public.announcement_dismissals (
  studio_id uuid not null references public.studios (id) on delete cascade,
  announcement_id uuid not null,
  student_id uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, student_id),
  foreign key (studio_id, announcement_id) references public.announcements (studio_id, id) on delete cascade,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete cascade
);

-- ¿El alumno está entre los destinatarios del anuncio?
create function private.announcement_targets(p_announcement public.announcements, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.students s
    where s.id = p_student_id and s.studio_id = p_announcement.studio_id and s.is_active
  )
  and case p_announcement.audience
    when 'all' then true
    when 'offering' then exists (
      select 1 from public.bookings b
      join public.sessions se on se.id = b.session_id
      where b.student_id = p_student_id
        and se.offering_id = p_announcement.offering_id
        and b.status in ('booked', 'attended')
        and se.starts_at > now() - interval '30 days'
    )
    when 'formation' then exists (
      select 1 from public.formation_enrollments e
      where e.student_id = p_student_id
        and e.formation_id = p_announcement.formation_id
        and e.status in ('approved', 'enrolled')
    )
    else false
  end
$$;

revoke execute on function private.announcement_targets(public.announcements, uuid) from public, anon;
grant execute on function private.announcement_targets(public.announcements, uuid) to authenticated, service_role;

alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;
revoke all on public.announcements, public.announcement_dismissals from anon, authenticated;
grant select, delete on public.announcements to authenticated;
grant select on public.announcement_dismissals to authenticated;

create policy announcements_read on public.announcements for select to authenticated
  using (
    private.is_studio_staff(studio_id)
    or exists (
      select 1 from public.students s
      where s.studio_id = announcements.studio_id
        and s.id in (select private.my_student_ids())
        and private.announcement_targets(announcements, s.id)
    )
  );
create policy announcements_admin_delete on public.announcements for delete to authenticated
  using (private.is_studio_admin(studio_id));

create policy announcement_dismissals_read on public.announcement_dismissals for select to authenticated
  using (private.is_studio_staff(studio_id) or student_id in (select private.my_student_ids()));

-- -----------------------------------------------------------------------------
-- publish_announcement: el dueño o un encargado lo publica; si send_email, se
-- encola un mail para cada destinatario con email (hasta 3000).
-- -----------------------------------------------------------------------------
create function public.publish_announcement(
  p_studio_id uuid,
  p_title text,
  p_body text,
  p_audience text default 'all',
  p_offering_id uuid default null,
  p_formation_id uuid default null,
  p_visible_until timestamptz default null,
  p_send_email boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.announcements%rowtype;
  v_count integer := 0;
  r record;
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('Solo el dueño o un encargado pueden publicar anuncios.', 'forbidden');
  end if;
  if not public.studio_has_feature(p_studio_id, 'announcements') then
    perform private.fail('Los anuncios están en el plan Estudio.', 'feature_unavailable');
  end if;
  if p_audience = 'offering' and not exists (select 1 from public.offerings where id = p_offering_id and studio_id = p_studio_id) then
    perform private.fail('Elegí una clase del estudio.', 'offering_not_found');
  end if;
  if p_audience = 'formation' and not exists (select 1 from public.formations where id = p_formation_id and studio_id = p_studio_id) then
    perform private.fail('Elegí una formación del estudio.', 'formation_not_found');
  end if;
  if p_visible_until is not null and p_visible_until <= now() then
    perform private.fail('La fecha hasta la que se ve tiene que ser futura.', 'invalid_date');
  end if;

  insert into public.announcements (studio_id, title, body, audience, offering_id, formation_id, visible_until, send_email, created_by)
  values (
    p_studio_id, btrim(p_title), btrim(p_body), p_audience,
    case when p_audience = 'offering' then p_offering_id end,
    case when p_audience = 'formation' then p_formation_id end,
    p_visible_until, coalesce(p_send_email, true), auth.uid()
  )
  returning * into v_a;

  if v_a.send_email then
    for r in
      select s.id from public.students s
      where s.studio_id = p_studio_id and s.is_active and s.email is not null
        and private.announcement_targets(v_a, s.id)
      limit 3000
    loop
      perform private.enqueue_notification(
        p_studio_id, r.id, 'announcement', jsonb_build_object('announcement_id', v_a.id),
        now(), 'announcement:' || v_a.id || ':' || r.id
      );
      v_count := v_count + 1;
    end loop;
    update public.announcements set emailed_count = v_count where id = v_a.id;
  end if;

  return jsonb_build_object('announcement_id', v_a.id, 'emailed', v_count);
end;
$$;

-- El alumno cierra el cartel (no vuelve a aparecer).
create function public.dismiss_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.announcements%rowtype;
  v_student_id uuid;
begin
  select * into v_a from public.announcements where id = p_announcement_id;
  if not found then
    perform private.fail('No encontramos ese anuncio.', 'announcement_not_found');
  end if;
  select s.id into v_student_id from public.students s
  where s.studio_id = v_a.studio_id and s.user_id = auth.uid();
  if v_student_id is null then
    perform private.fail('No encontramos ese anuncio.', 'announcement_not_found');
  end if;
  insert into public.announcement_dismissals (studio_id, announcement_id, student_id)
  values (v_a.studio_id, v_a.id, v_student_id)
  on conflict do nothing;
end;
$$;

grant execute on function public.publish_announcement(uuid, text, text, text, uuid, uuid, timestamptz, boolean) to authenticated, service_role;
grant execute on function public.dismiss_announcement(uuid) to authenticated, service_role;
