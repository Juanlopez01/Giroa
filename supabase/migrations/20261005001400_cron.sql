-- =============================================================================
-- Tareas programadas con pg_cron (horarios en UTC; Argentina = UTC-3).
-- Lo que necesita salir a internet (envío de emails, refresh de tokens de MP)
-- lo hace el servidor; se agenda en una migración posterior con pg_net.
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;

-- Sesiones de las próximas 4 semanas: lunes 03:00 ART.
select cron.schedule('giroa_generate_sessions', '0 6 * * 1', $$select private.generate_sessions_all(4)$$);

-- Vencimiento de packs: todos los días 00:05 ART.
select cron.schedule('giroa_expire_packs', '5 3 * * *', $$select public.expire_packs()$$);

-- Aviso de pack por vencer: todos los días 10:00 ART.
select cron.schedule('giroa_pack_expiring', '0 13 * * *', $$select private.enqueue_pack_expiring()$$);

-- Recordatorio de clase y ausentes: cada hora.
select cron.schedule('giroa_class_reminders', '0 * * * *', $$select private.enqueue_class_reminders()$$);
select cron.schedule('giroa_mark_no_shows', '30 * * * *', $$select private.mark_no_shows()$$);
