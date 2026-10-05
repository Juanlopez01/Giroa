-- =============================================================================
-- Helpers de tests (pgTAP). Este archivo corre primero y hace COMMIT para que
-- los helpers queden disponibles en los demás archivos. Cada test corre en su
-- propia transacción con ROLLBACK.
--
-- Patrón: las aserciones corren como postgres; las consultas a probar corren
-- con el rol y el usuario que correspondan vía tests.q / tests.exec / tests.err.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.create_user(p_id uuid, p_email text)
returns uuid
language sql
as $$
  insert into auth.users (id, email) values (p_id, p_email) returning id
$$;

-- Cambia rol + claims del JWT (local a la transacción).
create or replace function tests.set_auth(p_role text, p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', p_role, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', p_role, 'sub', p_uid)::text,
    true
  );
end;
$$;

create or replace function tests.clear_auth()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Ejecuta una consulta como (rol, usuario) y devuelve las filas como jsonb.
create or replace function tests.q(p_role text, p_uid uuid, p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  perform tests.set_auth(p_role, p_uid);
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', p_sql) into v_result;
  perform tests.clear_auth();
  return v_result;
end;
$$;

-- Cantidad de filas visibles.
create or replace function tests.count(p_role text, p_uid uuid, p_sql text)
returns integer
language sql
as $$
  select jsonb_array_length(tests.q(p_role, p_uid, p_sql))
$$;

-- Ejecuta una sentencia (DML o RPC) y devuelve las filas afectadas.
create or replace function tests.exec(p_role text, p_uid uuid, p_sql text)
returns integer
language plpgsql
as $$
declare
  v_rows integer;
begin
  perform tests.set_auth(p_role, p_uid);
  execute p_sql;
  get diagnostics v_rows = row_count;
  perform tests.clear_auth();
  return v_rows;
end;
$$;

-- Ejecuta y devuelve el código de error: el hint de los errores de negocio,
-- o el SQLSTATE si no tiene hint. 'OK' si no hubo error.
create or replace function tests.err(p_role text, p_uid uuid, p_sql text)
returns text
language plpgsql
as $$
declare
  v_hint text;
  v_state text;
begin
  begin
    perform tests.set_auth(p_role, p_uid);
    execute p_sql;
    perform tests.clear_auth();
    return 'OK';
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint, v_state = returned_sqlstate;
    perform tests.clear_auth();
    return coalesce(nullif(v_hint, ''), v_state);
  end;
end;
$$;

-- Igual que tests.err pero devuelve el mensaje (para probar los textos).
create or replace function tests.err_message(p_role text, p_uid uuid, p_sql text)
returns text
language plpgsql
as $$
declare
  v_message text;
begin
  begin
    perform tests.set_auth(p_role, p_uid);
    execute p_sql;
    perform tests.clear_auth();
    return null;
  exception when others then
    get stacked diagnostics v_message = message_text;
    perform tests.clear_auth();
    return v_message;
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fixture: dos estudios con datos. Ids fijos para leer los tests fácil.
--   Usuarios:  a1 owner A · a2 profe A · a3 alumna A (líder) · a4 alumno A (seguidor)
--              b1 owner B · b3 alumno B · c1 usuario sin estudio
--   Estudio A (tango + yoga) · Estudio B (tango)
-- -----------------------------------------------------------------------------
create or replace function tests.fixture()
returns void
language plpgsql
as $$
declare
  u_owner_a  uuid := '00000000-0000-0000-0000-0000000000a1';
  u_teach_a  uuid := '00000000-0000-0000-0000-0000000000a2';
  u_stud_a1  uuid := '00000000-0000-0000-0000-0000000000a3';
  u_stud_a2  uuid := '00000000-0000-0000-0000-0000000000a4';
  u_owner_b  uuid := '00000000-0000-0000-0000-0000000000b1';
  u_stud_b   uuid := '00000000-0000-0000-0000-0000000000b3';
  u_outsider uuid := '00000000-0000-0000-0000-0000000000c1';
  st_a uuid := '10000000-0000-0000-0000-00000000000a';
  st_b uuid := '10000000-0000-0000-0000-00000000000b';
begin
  perform tests.create_user(u_owner_a, 'owner-a@test.com');
  perform tests.create_user(u_teach_a, 'profe-a@test.com');
  perform tests.create_user(u_stud_a1, 'ana@test.com');
  perform tests.create_user(u_stud_a2, 'beto@test.com');
  perform tests.create_user(u_owner_b, 'owner-b@test.com');
  perform tests.create_user(u_stud_b, 'bruno@test.com');
  perform tests.create_user(u_outsider, 'nadie@test.com');

  insert into public.studios (id, slug, name, cancel_window_hours) values
    (st_a, 'estudio-a', 'Estudio A', 3),
    (st_b, 'estudio-b', 'Estudio B', 3);

  insert into public.studio_members (id, studio_id, user_id, role, display_name) values
    ('20000000-0000-0000-0000-0000000000a1', st_a, u_owner_a, 'owner', 'Owner A'),
    ('20000000-0000-0000-0000-0000000000a2', st_a, u_teach_a, 'teacher', 'Profe A'),
    ('20000000-0000-0000-0000-0000000000b1', st_b, u_owner_b, 'owner', 'Owner B');

  -- Alumnos: s-a1 a s-a5 en A (a3 y a4 con cuenta), s-b1 en B.
  insert into public.students (id, studio_id, user_id, full_name, email, default_role) values
    ('30000000-0000-0000-0000-0000000000a1', st_a, u_stud_a1, 'Ana',    'ana@test.com',   'leader'),
    ('30000000-0000-0000-0000-0000000000a2', st_a, u_stud_a2, 'Beto',   'beto@test.com',  'follower'),
    ('30000000-0000-0000-0000-0000000000a3', st_a, null,      'Carla',  'carla@test.com', 'leader'),
    ('30000000-0000-0000-0000-0000000000a4', st_a, null,      'Dani',   null,             'follower'),
    ('30000000-0000-0000-0000-0000000000a5', st_a, null,      'Eli',    null,             'leader'),
    ('30000000-0000-0000-0000-0000000000b1', st_b, u_stud_b,  'Bruno',  'bruno@test.com', 'leader');

  -- Actividades: tango A (cupo 4, balance 1), yoga A (cupo 2), tango B.
  insert into public.offerings (id, studio_id, discipline_key, title, capacity, role_balance_max_diff, teacher_member_id) values
    ('40000000-0000-0000-0000-0000000000a1', st_a, 'tango', 'Tango inicial', 4, 1, '20000000-0000-0000-0000-0000000000a2'),
    ('40000000-0000-0000-0000-0000000000a2', st_a, 'yoga',  'Yoga', 2, null, null),
    ('40000000-0000-0000-0000-0000000000b1', st_b, 'tango', 'Tango B', 10, 1, null);

  insert into public.sessions (id, studio_id, offering_id, starts_at, ends_at) values
    -- tango A mañana
    ('50000000-0000-0000-0000-0000000000a1', st_a, '40000000-0000-0000-0000-0000000000a1', now() + interval '1 day', now() + interval '1 day 90 minutes'),
    -- yoga A mañana
    ('50000000-0000-0000-0000-0000000000a2', st_a, '40000000-0000-0000-0000-0000000000a2', now() + interval '1 day', now() + interval '1 day 60 minutes'),
    -- tango A en 2 horas (dentro de la ventana de cancelación)
    ('50000000-0000-0000-0000-0000000000a3', st_a, '40000000-0000-0000-0000-0000000000a1', now() + interval '2 hours', now() + interval '3 hours 30 minutes'),
    -- tango A que empezó hace 10 minutos
    ('50000000-0000-0000-0000-0000000000a4', st_a, '40000000-0000-0000-0000-0000000000a1', now() - interval '10 minutes', now() + interval '80 minutes'),
    -- tango B mañana
    ('50000000-0000-0000-0000-0000000000b1', st_b, '40000000-0000-0000-0000-0000000000b1', now() + interval '1 day', now() + interval '1 day 90 minutes');

  insert into public.pack_products (id, studio_id, name, credits, validity_days, price_cents) values
    ('60000000-0000-0000-0000-0000000000a1', st_a, '8 clases', 8, 30, 3000000),
    ('60000000-0000-0000-0000-0000000000a2', st_a, 'Libre', null, 30, 5000000),
    ('60000000-0000-0000-0000-0000000000b1', st_b, '4 clases', 4, 30, 1500000);

  -- Saldo: Ana, Beto, Carla, Dani y Eli con 8 clases en A; Bruno con 4 en B.
  insert into public.student_packs (id, studio_id, student_id, pack_product_id, name, credits_total, expires_at) values
    ('70000000-0000-0000-0000-0000000000a1', st_a, '30000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a1', '8 clases', 8, now() + interval '30 days'),
    ('70000000-0000-0000-0000-0000000000a2', st_a, '30000000-0000-0000-0000-0000000000a2', '60000000-0000-0000-0000-0000000000a1', '8 clases', 8, now() + interval '30 days'),
    ('70000000-0000-0000-0000-0000000000a3', st_a, '30000000-0000-0000-0000-0000000000a3', '60000000-0000-0000-0000-0000000000a1', '8 clases', 8, now() + interval '30 days'),
    ('70000000-0000-0000-0000-0000000000a4', st_a, '30000000-0000-0000-0000-0000000000a4', '60000000-0000-0000-0000-0000000000a1', '8 clases', 8, now() + interval '30 days'),
    ('70000000-0000-0000-0000-0000000000a5', st_a, '30000000-0000-0000-0000-0000000000a5', '60000000-0000-0000-0000-0000000000a1', '8 clases', 8, now() + interval '30 days'),
    ('70000000-0000-0000-0000-0000000000b1', st_b, '30000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-0000000000b1', '4 clases', 4, now() + interval '30 days');
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select ok(true, 'helpers de tests instalados');
select * from finish();

commit;
