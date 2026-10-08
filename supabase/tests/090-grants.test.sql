-- Regresión de permisos: qué funciones de public puede ejecutar cada rol.
-- Si agregás una RPC, sumala acá a propósito.
begin;
select plan(3);

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  'audition_slot_availability, check_slug, create_event_order, create_gift_card_order, event_availability, get_event_order, get_gift_card, get_invite, list_public_sessions, preview_coupon, studio_accepts_online_payments, studio_has_feature',
  'anon solo ejecuta las RPC públicas');

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')),
  'accept_invite, active_students_count, apply_to_audition, apply_to_formation, audition_slot_availability, book_session, cancel_audition_application, cancel_booking, cancel_event_order, cancel_gift_card, cancel_invite, cancel_session, check_in, check_in_by_qr, check_in_ticket, check_slug, choose_full_payment, choose_trial_plan, create_event_order, create_gift_card_order, create_pack_payment, create_studio, decide_enrollment, enrollment_progress, event_availability, formation_check_in, formation_set_grade, generate_sessions, get_event_order, get_gift_card, get_invite, giroa_quote, grant_pack, import_students, invite_member, join_studio, join_waitlist, leave_waitlist, list_public_sessions, mp_connection_status, my_trial_available, my_waitlist, preview_coupon, record_audition_payment, record_formation_payment, record_manual_payment, redeem_gift_card, remove_member, remove_schedule, rotate_checkin_code, self_check_in, sell_event_tickets_manual, sell_gift_card_manual, set_audition_result, studio_accepts_online_payments, studio_access, studio_has_feature, studio_usage, update_member, update_my_student_profile, withdraw_enrollment',
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
