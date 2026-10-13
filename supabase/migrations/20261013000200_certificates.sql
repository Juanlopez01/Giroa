-- =============================================================================
-- Certificados de formaciones (feature 'certificates', plan Pro).
--
-- Uno por inscripción. Se guarda una copia del nombre, la formación y quién
-- firma: si después editan algo, el certificado emitido no cambia. Código
-- público (CERT-XXXX-XXXX) para verificarlo (get_certificate, sin login) y
-- descargar el PDF.
--
-- Requisitos (private.certificate_check): inscripto, asistencia mínima de la
-- formación sobre los encuentros dados, evaluaciones aprobadas y sin cuotas
-- vencidas impagas. El estudio decide: si no cumple, puede emitirlo igual.
-- =============================================================================

alter table public.formations
  add column certificate_signer_name text check (char_length(certificate_signer_name) <= 120),
  add column certificate_signer_role text check (char_length(certificate_signer_role) <= 80),
  add column certificate_text text check (char_length(certificate_text) <= 300);

create function private.certificate_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_out text := '';
  i integer;
begin
  for i in 0..7 loop
    v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    if i = 3 then v_out := v_out || '-'; end if;
  end loop;
  return 'CERT-' || v_out;
end;
$$;

revoke execute on function private.certificate_code() from public, anon, authenticated;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  formation_id uuid not null,
  enrollment_id uuid not null unique,
  student_id uuid not null,
  code text not null unique default private.certificate_code(),
  student_name text not null,
  formation_title text not null,
  certificate_text text,
  signer_name text,
  signer_role text,
  -- Fecha que figura en el certificado (día en que terminó la formación o de emisión).
  completed_on date not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users (id) on delete set null,
  -- Se emitió sin cumplir algún requisito (lo decidió el estudio).
  forced boolean not null default false,
  revoked_at timestamptz,
  revoke_reason text check (char_length(revoke_reason) <= 300),
  unique (studio_id, id),
  foreign key (studio_id, formation_id) references public.formations (studio_id, id) on delete cascade,
  foreign key (studio_id, enrollment_id) references public.formation_enrollments (studio_id, id) on delete cascade,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete cascade
);

create index certificates_formation_idx on public.certificates (formation_id);

alter table public.certificates enable row level security;
revoke all on public.certificates from anon, authenticated;
grant select on public.certificates to authenticated;

create policy certificates_read on public.certificates for select to authenticated
  using (private.is_studio_admin(studio_id) or student_id in (select private.my_student_ids()));

-- -----------------------------------------------------------------------------
-- ¿Cumple los requisitos? { eligible, attendance_pct, reasons[] }
-- -----------------------------------------------------------------------------
create function private.certificate_check(p_enrollment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
  v_f public.formations%rowtype;
  v_tz text;
  v_held integer;
  v_left integer;
  v_attended integer;
  v_pct integer;
  v_failed text;
  v_reasons text[] := '{}';
begin
  select * into v_e from public.formation_enrollments where id = p_enrollment_id;
  select * into v_f from public.formations where id = v_e.formation_id;
  select timezone into v_tz from public.studios where id = v_e.studio_id;

  if v_e.status <> 'enrolled' then
    v_reasons := v_reasons || 'No está inscripto/a.'::text;
  end if;

  select count(*) filter (where starts_at <= now()), count(*) filter (where starts_at > now())
  into v_held, v_left
  from public.formation_sessions where formation_id = v_f.id;
  select count(*) into v_attended
  from public.formation_attendance a join public.formation_sessions s on s.id = a.formation_session_id
  where a.enrollment_id = v_e.id and s.starts_at <= now();
  v_pct := case when v_held = 0 then 100 else round(v_attended * 100.0 / v_held) end;

  if v_pct < v_f.min_attendance_pct then
    v_reasons := v_reasons || format('Asistencia %s%% (mínimo %s%%).', v_pct, v_f.min_attendance_pct);
  end if;
  if v_left > 0 then
    v_reasons := v_reasons || case when v_left = 1 then 'Falta 1 encuentro.' else format('Faltan %s encuentros.', v_left) end;
  end if;

  select string_agg(a.title, ', ' order by a.due_on nulls last, a.title) into v_failed
  from public.formation_assessments a
  left join public.formation_grades g on g.assessment_id = a.id and g.enrollment_id = v_e.id
  where a.formation_id = v_f.id and coalesce(g.passed, false) = false;
  if v_failed is not null then
    v_reasons := v_reasons || ('Falta aprobar: ' || v_failed || '.');
  end if;

  if exists (
    select 1 from public.formation_charges c
    where c.enrollment_id = v_e.id and c.status = 'pending' and c.due_on <= (now() at time zone v_tz)::date
  ) then
    v_reasons := v_reasons || 'Tiene cuotas vencidas sin pagar.'::text;
  end if;

  return jsonb_build_object('eligible', cardinality(v_reasons) = 0, 'attendance_pct', v_pct, 'reasons', to_jsonb(v_reasons));
end;
$$;

revoke execute on function private.certificate_check(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Para el panel: cada inscripto con lo que le falta y su certificado.
-- -----------------------------------------------------------------------------
create function public.certificate_status(p_formation_id uuid)
returns table (
  enrollment_id uuid,
  student_name text,
  eligible boolean,
  attendance_pct integer,
  reasons jsonb,
  certificate_id uuid,
  code text,
  issued_at timestamptz,
  forced boolean,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_studio uuid;
begin
  select studio_id into v_studio from public.formations where id = p_formation_id;
  if v_studio is null or not private.is_studio_admin(v_studio) then
    perform private.fail('No encontramos esa formación.', 'formation_not_found');
  end if;

  return query
  select e.id, st.full_name,
    (chk ->> 'eligible')::boolean, (chk ->> 'attendance_pct')::integer, chk -> 'reasons',
    c.id, c.code, c.issued_at, c.forced, c.revoked_at
  from public.formation_enrollments e
  join public.students st on st.id = e.student_id
  cross join lateral private.certificate_check(e.id) chk
  left join public.certificates c on c.enrollment_id = e.id
  where e.formation_id = p_formation_id and (e.status = 'enrolled' or c.id is not null)
  order by st.full_name;
end;
$$;

revoke execute on function public.certificate_status(uuid) from public, anon, authenticated;
grant execute on function public.certificate_status(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Emitir (dueño o encargado). Si no cumple: falla con not_eligible salvo
-- p_force. Si estaba anulado, se vuelve a emitir con un código nuevo.
-- -----------------------------------------------------------------------------
create function private.issue_certificate_core(p_enrollment_id uuid, p_force boolean)
returns public.certificates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.formation_enrollments%rowtype;
  v_f public.formations%rowtype;
  v_chk jsonb;
  v_tz text;
  v_cert public.certificates%rowtype;
begin
  select * into v_e from public.formation_enrollments where id = p_enrollment_id;
  if not found or not private.is_studio_admin(v_e.studio_id) then
    perform private.fail('No encontramos esa inscripción.', 'enrollment_not_found');
  end if;
  if not public.studio_has_feature(v_e.studio_id, 'certificates') then
    perform private.fail('Los certificados están en el plan Pro.', 'feature_unavailable');
  end if;
  if v_e.status <> 'enrolled' then
    perform private.fail('Solo se emite a alumnos inscriptos.', 'not_enrolled');
  end if;

  select * into v_cert from public.certificates where enrollment_id = v_e.id for update;
  if found and v_cert.revoked_at is null then
    perform private.fail('Ya tiene su certificado.', 'already_issued');
  end if;

  v_chk := private.certificate_check(v_e.id);
  if not (v_chk ->> 'eligible')::boolean and not coalesce(p_force, false) then
    perform private.fail('Todavía no cumple los requisitos: ' || (select string_agg(r, ' ') from jsonb_array_elements_text(v_chk -> 'reasons') r),
      'not_eligible');
  end if;

  select * into v_f from public.formations where id = v_e.formation_id;
  select timezone into v_tz from public.studios where id = v_e.studio_id;
  delete from public.certificates where enrollment_id = v_e.id;

  insert into public.certificates (
    studio_id, formation_id, enrollment_id, student_id, student_name, formation_title, certificate_text,
    signer_name, signer_role, completed_on, issued_by, forced
  )
  select v_e.studio_id, v_f.id, v_e.id, v_e.student_id, st.full_name, v_f.title, v_f.certificate_text,
    v_f.certificate_signer_name, v_f.certificate_signer_role,
    least(v_f.ends_on, (now() at time zone v_tz)::date), auth.uid(), not (v_chk ->> 'eligible')::boolean
  from public.students st where st.id = v_e.student_id
  returning * into v_cert;

  perform private.enqueue_notification(
    v_e.studio_id, v_e.student_id, 'certificate_issued',
    jsonb_build_object('code', v_cert.code, 'formation_title', v_f.title, 'formation_id', v_f.id),
    now(), 'certificate_issued:' || v_cert.id
  );
  return v_cert;
end;
$$;

revoke execute on function private.issue_certificate_core(uuid, boolean) from public, anon, authenticated;

create function public.issue_certificate(p_enrollment_id uuid, p_force boolean default false)
returns public.certificates
language sql
security definer
set search_path = ''
as $$
  select * from private.issue_certificate_core(p_enrollment_id, p_force)
$$;

revoke execute on function public.issue_certificate(uuid, boolean) from public, anon, authenticated;
grant execute on function public.issue_certificate(uuid, boolean) to authenticated;

-- A todos los inscriptos que cumplen y todavía no lo tienen. Devuelve cuántos.
create function public.issue_certificates(p_formation_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio uuid;
  v_enrollment uuid;
  v_count integer := 0;
begin
  select studio_id into v_studio from public.formations where id = p_formation_id;
  if v_studio is null or not private.is_studio_admin(v_studio) then
    perform private.fail('No encontramos esa formación.', 'formation_not_found');
  end if;
  if not public.studio_has_feature(v_studio, 'certificates') then
    perform private.fail('Los certificados están en el plan Pro.', 'feature_unavailable');
  end if;

  for v_enrollment in
    select e.id from public.formation_enrollments e
    left join public.certificates c on c.enrollment_id = e.id and c.revoked_at is null
    where e.formation_id = p_formation_id and e.status = 'enrolled' and c.id is null
      and (private.certificate_check(e.id) ->> 'eligible')::boolean
  loop
    perform private.issue_certificate_core(v_enrollment, false);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.issue_certificates(uuid) from public, anon, authenticated;
grant execute on function public.issue_certificates(uuid) to authenticated;

create function public.revoke_certificate(p_certificate_id uuid, p_reason text default null)
returns public.certificates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cert public.certificates%rowtype;
begin
  select * into v_cert from public.certificates where id = p_certificate_id for update;
  if not found or not private.is_studio_admin(v_cert.studio_id) then
    perform private.fail('No encontramos ese certificado.', 'certificate_not_found');
  end if;
  if v_cert.revoked_at is not null then
    return v_cert;
  end if;
  update public.certificates set revoked_at = now(), revoke_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = v_cert.id returning * into v_cert;
  return v_cert;
end;
$$;

revoke execute on function public.revoke_certificate(uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_certificate(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Verificación pública por código (sin login): lo que figura en el certificado.
-- -----------------------------------------------------------------------------
create function public.get_certificate(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', c.code,
    'student_name', c.student_name,
    'formation_title', c.formation_title,
    'certificate_text', c.certificate_text,
    'signer_name', c.signer_name,
    'signer_role', c.signer_role,
    'completed_on', c.completed_on,
    'revoked', c.revoked_at is not null,
    'studio_slug', s.slug,
    'studio_name', s.name,
    'brand_color', s.brand_color,
    'logo_path', s.logo_path
  )
  from public.certificates c
  join public.studios s on s.id = c.studio_id
  where c.code = upper(btrim(p_code))
$$;

revoke execute on function public.get_certificate(text) from public;
grant execute on function public.get_certificate(text) to anon, authenticated, service_role;
