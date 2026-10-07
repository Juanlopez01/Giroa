-- Regresión de permisos: qué funciones de public puede ejecutar cada rol.
-- Si agregás una RPC, sumala acá a propósito.
begin;
select plan(3);

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  'check_slug, create_event_order, event_availability, get_event_order, get_invite, list_public_sessions, studio_accepts_online_payments, studio_has_feature',
  'anon solo ejecuta las RPC públicas');

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')),
  'accept_invite, active_students_count, book_session, cancel_booking, cancel_event_order, cancel_invite, cancel_session, check_in, check_in_by_qr, check_in_ticket, check_slug, choose_trial_plan, create_event_order, create_pack_payment, create_studio, event_availability, generate_sessions, get_event_order, get_invite, giroa_quote, grant_pack, import_students, invite_member, join_studio, join_waitlist, leave_waitlist, list_public_sessions, mp_connection_status, my_trial_available, my_waitlist, record_manual_payment, remove_member, remove_schedule, sell_event_tickets_manual, studio_accepts_online_payments, studio_access, studio_has_feature, studio_usage, update_member, update_my_student_profile',
  'authenticated ejecuta solo las RPC previstas');

select ok(
  not has_function_privilege('authenticated', 'public.mp_apply_payment(uuid, text, text, bigint, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.expire_packs()', 'execute')
  and not has_function_privilege('authenticated', 'public.mp_apply_event_payment(uuid, text, text, bigint, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.expire_event_orders()', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_notifications(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.finish_notification(bigint, boolean, text)', 'execute'),
  'las funciones del webhook y del cron son solo para el servidor');

select * from finish();
rollback;
