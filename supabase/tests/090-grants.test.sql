-- Regresión de permisos: qué funciones de public puede ejecutar cada rol.
-- Si agregás una RPC, sumala acá a propósito.
begin;
select plan(3);

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  'check_slug, list_public_sessions, studio_has_feature',
  'anon solo ejecuta las RPC públicas');

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')),
  'active_students_count, book_session, cancel_booking, cancel_session, check_in, check_in_by_qr, check_slug, create_pack_payment, create_studio, generate_sessions, grant_pack, join_studio, list_public_sessions, mp_connection_status, record_manual_payment, studio_has_feature, studio_usage, update_my_student_profile',
  'authenticated ejecuta solo las RPC previstas');

select ok(
  not has_function_privilege('authenticated', 'public.mp_apply_payment(uuid, text, text, bigint, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.expire_packs()', 'execute'),
  'las funciones del webhook y del cron son solo para el servidor');

select * from finish();
rollback;
