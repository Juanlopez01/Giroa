-- =============================================================================
-- import_students: migración desde Excel/CSV (alumnos y saldos actuales).
--
-- p_rows: array de objetos { full_name, email?, phone?, default_role?,
--          credits?, unlimited?, expires_on? (YYYY-MM-DD) }
-- Por fila: si hay email y ya existe en el estudio, actualiza lo vacío; si no,
-- crea el alumno (sujeto al límite del plan). Si trae saldo (credits > 0 o
-- unlimited) le carga un pack "Saldo importado" que vence al final de
-- expires_on (hora del estudio), registrado en el historial como 'adjust'.
-- Cada fila corre en su propia subtransacción: un error no frena el resto.
--
-- Devuelve { created, updated, packs, errors: [{ row, message }] }.
-- =============================================================================

create function public.import_students(p_studio_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_row jsonb;
  v_index integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_packs integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_student_id uuid;
  v_email text;
  v_name text;
  v_credits integer;
  v_unlimited boolean;
  v_expires_on date;
  v_pack_id uuid;
  v_message text;
begin
  if not (private.is_privileged() or private.is_studio_admin(p_studio_id)) then
    perform private.fail('No tenés permiso para importar alumnos en este estudio.', 'forbidden');
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    perform private.fail('El archivo no tiene filas para importar.', 'empty_import');
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    perform private.fail('Se pueden importar hasta 2000 alumnos por vez.', 'import_too_large');
  end if;

  select timezone into v_tz from public.studios where id = p_studio_id;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    begin
      v_name := nullif(btrim(v_row ->> 'full_name'), '');
      v_email := nullif(lower(btrim(v_row ->> 'email')), '');
      v_credits := nullif(v_row ->> 'credits', '')::integer;
      v_unlimited := coalesce((v_row ->> 'unlimited')::boolean, false);
      v_expires_on := nullif(v_row ->> 'expires_on', '')::date;

      if v_name is null then
        perform private.fail('Falta el nombre.', 'invalid_name');
      end if;
      if (v_unlimited or coalesce(v_credits, 0) > 0) and v_expires_on is null then
        perform private.fail('Tiene saldo pero falta la fecha de vencimiento.', 'missing_expiry');
      end if;
      if v_credits is not null and v_credits < 0 then
        perform private.fail('Las clases no pueden ser negativas.', 'invalid_credits');
      end if;

      v_student_id := null;
      if v_email is not null then
        select id into v_student_id from public.students
        where studio_id = p_studio_id and email = v_email
        for update;
      end if;

      if v_student_id is not null then
        update public.students s set
          phone = coalesce(s.phone, nullif(btrim(v_row ->> 'phone'), '')),
          default_role = coalesce(s.default_role, nullif(v_row ->> 'default_role', '')::public.dance_role)
        where s.id = v_student_id;
        v_updated := v_updated + 1;
      else
        insert into public.students (studio_id, full_name, email, phone, default_role)
        values (
          p_studio_id, v_name, v_email, nullif(btrim(v_row ->> 'phone'), ''),
          nullif(v_row ->> 'default_role', '')::public.dance_role
        )
        returning id into v_student_id;
        v_created := v_created + 1;
      end if;

      if v_unlimited or coalesce(v_credits, 0) > 0 then
        insert into public.student_packs (studio_id, student_id, name, credits_total, starts_at, expires_at)
        values (
          p_studio_id, v_student_id, 'Saldo importado',
          case when v_unlimited then null else v_credits end,
          now(),
          ((v_expires_on + 1)::timestamp) at time zone v_tz
        )
        returning id into v_pack_id;

        insert into public.pack_credit_events (studio_id, student_pack_id, kind, delta, note, created_by)
        values (p_studio_id, v_pack_id, 'adjust', coalesce(case when v_unlimited then 0 else v_credits end, 0),
                'Saldo importado', v_uid);
        v_packs := v_packs + 1;
      end if;
    exception when others then
      get stacked diagnostics v_message = message_text;
      if sqlstate = '22P02' or sqlstate = '22007' or sqlstate = '22008' then
        v_message := 'Hay un dato con formato inválido (rol, clases o fecha).';
      elsif sqlstate = '23514' then
        v_message := 'Hay un dato inválido (revisá el email y la fecha de vencimiento).';
      elsif sqlstate <> 'P0001' then
        v_message := 'No se pudo importar esta fila.';
      end if;
      v_errors := v_errors || jsonb_build_object('row', v_index, 'message', v_message);
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'packs', v_packs, 'errors', v_errors);
end;
$$;

revoke execute on function public.import_students(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_students(uuid, jsonb) to authenticated, service_role;
