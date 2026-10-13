-- =============================================================================
-- Aviso de material nuevo (template material_new): el staff lo pide al subir
-- algo a la biblioteca o al material de una formación (check "Avisarles por
-- mail", apagado por defecto: subir diez archivos no manda diez mails).
--
-- Le llega solo a quien lo puede ver: biblioteca 'all' → alumnos activos;
-- 'pack' → con pack vigente; formación → inscriptos sin deuda. Un aviso por
-- material y alumno (dedupe_key). Devuelve cuántos avisos encoló.
-- =============================================================================

create function public.notify_new_material(p_kind text, p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_studio uuid;
  v_title text;
  v_audience text;
  v_formation public.formations%rowtype;
  v_student uuid;
  v_count integer := 0;
begin
  if p_kind = 'library' then
    select studio_id, title, audience into v_studio, v_title, v_audience from public.library_items where id = p_id;
  elsif p_kind = 'formation' then
    select m.studio_id, m.title into v_studio, v_title from public.formation_materials m where m.id = p_id;
    select f.* into v_formation from public.formations f
    join public.formation_materials m on m.formation_id = f.id where m.id = p_id;
  end if;
  if v_studio is null or not (private.is_privileged() or private.is_studio_staff(v_studio)) then
    perform private.fail('No encontramos ese material.', 'material_not_found');
  end if;

  for v_student in
    select s.id from public.students s
    where p_kind = 'library' and s.studio_id = v_studio and s.is_active and s.email is not null
      and (
        v_audience = 'all'
        or exists (
          select 1 from public.student_balances b
          where b.studio_id = v_studio and b.is_usable and (b.student_id = s.id or b.partner_student_id = s.id)
        )
      )
    union
    select e.student_id from public.formation_enrollments e
    join public.students s on s.id = e.student_id
    where p_kind = 'formation' and e.formation_id = v_formation.id and e.status = 'enrolled'
      and s.email is not null and not private.enrollment_in_debt(e.id)
  loop
    continue when exists (select 1 from public.notifications where dedupe_key = 'material_new:' || p_id || ':' || v_student);
    perform private.enqueue_notification(
      v_studio, v_student, 'material_new',
      jsonb_build_object('title', v_title, 'kind', p_kind, 'formation_id', v_formation.id, 'formation_title', v_formation.title),
      now(), 'material_new:' || p_id || ':' || v_student
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.notify_new_material(text, uuid) from public, anon, authenticated;
grant execute on function public.notify_new_material(text, uuid) to authenticated, service_role;
