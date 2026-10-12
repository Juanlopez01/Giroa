-- =============================================================================
-- Mail de bienvenida a un alumno que cargó el estudio ("Ya sos parte de…"):
-- le avisa que tiene su lugar y cómo entrar a la app con su email (al entrar,
-- join_studio vincula sola la ficha que ya tenía con ese email).
--
-- Lo pide el staff explícitamente (al cobrarle un pack a alguien nuevo o al
-- darlo de alta): no es un trigger, para que importar un Excel no le mande
-- mails a todos. Una sola vez por alumno (dedupe_key).
-- =============================================================================

create function public.send_student_welcome(p_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_count integer;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found or not (private.is_privileged() or private.is_studio_staff(v_student.studio_id)) then
    perform private.fail('No encontramos a ese alumno en el estudio.', 'student_not_found');
  end if;
  if v_student.email is null then
    perform private.fail('Este alumno no tiene email: cargáselo para mandarle la bienvenida.', 'no_email');
  end if;

  select count(*) into v_count from public.notifications where dedupe_key = 'student_welcome:' || v_student.id;
  if v_count > 0 then
    return false; -- ya se la mandamos
  end if;

  perform private.enqueue_notification(
    v_student.studio_id, v_student.id, 'student_welcome',
    jsonb_build_object('has_account', v_student.user_id is not null),
    now(), 'student_welcome:' || v_student.id
  );
  return true;
end;
$$;

revoke execute on function public.send_student_welcome(uuid) from public, anon, authenticated;
grant execute on function public.send_student_welcome(uuid) to authenticated, service_role;
