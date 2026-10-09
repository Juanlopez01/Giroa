@AGENTS.md

# Giroa

SaaS B2B multi-tenant para estudios de danza y disciplinas de movimiento
(tango, salsa, yoga, pilates…). Mercado inicial: Argentina.

Stack: Next.js 16 (App Router, `src/proxy.ts` reemplaza al middleware) +
TypeScript estricto + Tailwind 4 · Supabase (Postgres, Auth con magic link,
Storage, RLS) · Mercado Pago marketplace (OAuth) · Vercel con `*.giroa.com.ar`.

## Cómo trabajamos

- Por fases y pasos chicos. **Antes de escribir código de una fase, mostrar el
  plan (archivos, tablas, pantallas) y esperar el OK de Juan.**
- Un commit por paso, mensaje claro en español.
- Si algo es ambiguo o choca con otra cosa: preguntar antes de decidir.
- Al cerrar una fase: qué quedó hecho, qué quedó pendiente y cómo probarlo.

## Reglas no negociables

1. **Multi-tenant en una sola app y una sola base.** Toda tabla de negocio lleva
   `studio_id` y tiene RLS activado. Las FKs entre tablas de negocio son
   compuestas `(studio_id, id)` para que la base impida cruzar estudios.
2. **Escrituras sensibles solo por RPC `security definer`** (reservas, saldo,
   pagos, inscripciones, resultados de audiciones). El alumno nunca escribe
   directo en esas tablas: no tienen grants de insert/update.
3. **`SUPABASE_SERVICE_ROLE_KEY` solo en el servidor** (`src/lib/supabase/admin.ts`,
   importa `server-only`). Nunca en un Client Component ni en `NEXT_PUBLIC_*`.
4. **Tokens de MP encriptados** con `src/lib/crypto/tokens.ts` (AES-256-GCM, AAD
   = studio). `mp_connections` y `mp_webhook_events` no tienen políticas RLS.
5. **Tests** de toda RPC nueva y de aislamiento RLS en `supabase/tests`.
6. **Textos en español rioplatense con voseo**, cercano y profesional. Errores
   humanos: "No tenés clases disponibles. Comprá un pack."
7. **Mobile first.**
8. **Nada hardcodeado por disciplina**: se usa `disciplines.features` (jsonb).
   Agregar una disciplina = insertar una fila.
9. **Feature gating central**: `public.studio_has_feature()` en SQL y
   `src/lib/gating` en TS. Nada de ifs por plan dispersos.

## Base de datos (supabase/)

- Migraciones versionadas en `supabase/migrations`. Nunca editar una migración
  ya aplicada en producción: crear una nueva.
- Catálogos que necesita producción (planes, features, disciplinas) van en
  migraciones. `supabase/seed.sql` es solo para desarrollo local.
- Esquema `private`: helpers e internos, no expuesto por la API.
  RLS usa `private.is_studio_staff`, `private.is_studio_admin`,
  `private.my_student_ids` (security definer, evitan recursión).
- **Funciones:** ninguna es ejecutable por defecto (default privileges
  revocados). Toda RPC nueva necesita `grant execute ... to authenticated` (o
  `anon` / `service_role`) explícito, y hay que sumarla al test
  `supabase/tests/090-grants.test.sql`.
- Funciones `security definer` siempre con `set search_path = ''` y nombres
  calificados (`public.tabla`, `extensions.gen_random_bytes`).
- **Errores de negocio:** `perform private.fail('Mensaje para mostrar.', 'codigo_estable')`.
  El mensaje va al usuario; el código (en `hint`) es para la lógica del front.
- `private.is_privileged()` = service role o proceso interno (pg_cron).
- Plata siempre en centavos (`bigint`). Fechas en `timestamptz`; los horarios
  de clase en hora local del estudio (`studios.timezone`).
- Packs: valen para todas las clases regulares del estudio; se consume primero
  el que vence antes; `pack_credit_events` es el historial de créditos.
- Formaciones (`formations`): postulación → el estudio aprueba (`decide_enrollment`) → matrícula →
  inscripto (se generan las cuotas). Cobros en `formation_charges` (MP con `"formacion:<uuid>"` o
  mostrador). Deuda: cuota impaga al día 10 del mes en que vence (`private.enrollment_in_debt`); bloquea
  solo lo de la formación (asistencia y "Mi formación"), nunca las clases regulares.
- Todo estudio nuevo arranca en plan **Inicial con 14 días de prueba** (sin tarjeta). Durante la
  prueba elige qué plan probar (`choose_trial_plan`). Después se suscribe solo con MP
  Suscripciones (cobra en la cuenta de Giroa); el plan lo activa el webhook vía
  `giroa_apply_preapproval` (service role). Sin pago: 7 días de gracia y después el panel queda
  pausado (`studio_access`), pero los alumnos siguen reservando. Códigos en `giroa_coupons`.
- Eventos con entradas (`event_tickets`, planes Estudio y Pro): cualquiera compra sin cuenta con
  `create_event_order` (reserva el cupo 20 min, bloquea el tipo de entrada para no sobrevender). Las
  pagas van por MP con `external_reference = "evento:<uuid>"` y las confirma `mp_apply_event_payment`.
  "Tus entradas" es un link privado (`access_token`). QR de entrada: `giroa-entrada:<token>`.
- Lista de espera (`waitlist`): `join_waitlist` solo si no hay lugar (o no para su rol); al cancelarse
  una reserva, un trigger encola `waitlist_spot` para los que esperan. Clase de prueba (`trial_class`):
  `book_session(..., p_trial => true)`, una por persona sin packs; `studios.trial_class_enabled`.
- Equipo (`teacher_permissions`): owner > admin (encargado) > teacher (profe). Se invita por email
  (`invite_member`, `accept_invite` con el mismo email). Pagos manuales: admin o profe con
  `can_take_payments` (`private.can_take_payments`). "Tu plan" solo el owner (`requireOwner`).
- Cupones (`coupons`): `create_pack_payment` y `create_event_order` reciben `p_coupon`; los usos van en
  `coupon_redemptions` (triggers los confirman o anulan según el pago). Gift cards (`gift_cards`): un pack
  de regalo; MP con `external_reference = "regalo:<uuid>"`, canje con `redeem_gift_card`.
- Audiciones (`auditions`): puerta de entrada a una formación. `apply_to_audition` valida el formulario
  armable, el video y el turno (reserva 20 min si hay arancel; MP `"audicion:<uuid>"`).
  `set_audition_result(admitted)` crea o aprueba la inscripción a la formación (matrícula).
- Presente con el QR del estudio (`qr_checkin`): el estudio imprime un cartel (Panel → Ajustes → QR de
  asistencia) con un link `…/app/presente?c=<code>` (`studio_checkin_codes`, no legible por alumnos). El
  alumno lo escanea y `self_check_in` le da el presente desde 30 min antes hasta que termina: clase
  reservada, reservar en el momento (`walk_in`) o encuentro de su formación (bloquea si debe).
  `rotate_checkin_code` invalida los carteles viejos. El QR del alumno (`check_in_by_qr`) queda de respaldo.
- Material de formaciones (`formation_materials`): archivos en el bucket **privado** `formation-materials`
  (`<studio>/<formación>/<archivo>`, 50 MB, PDF/imagen/audio; videos por link) o links. Lo carga el
  staff; lo ven el staff y los inscriptos al día (`private.formation_material_access`, con deuda no). El
  alumno abre los archivos con URLs firmadas de 10 minutos.
- Anuncios (`announcements`, Estudio y Pro): `publish_announcement` (dueño/encargado) a todos, a los de una
  clase (reserva en los últimos 30 días o futura) o a los de una formación; mail opcional (template
  `announcement`). El alumno los ve arriba del Inicio y los cierra con `dismiss_announcement`.
- Al llegar al límite de alumnos activos del plan: se avisa en el panel
  (`studio_usage.at_limit`) y se **bloquean las altas** de alumnos nuevos.
  Nunca se bloquean reservas de alumnos existentes.

### Tests de base de datos

`npm run db:test` (pgTAP). Patrón: `tests.fixture()` carga dos estudios con
ids fijos; las consultas se prueban como cada rol con `tests.q`, `tests.count`,
`tests.exec`, `tests.err` (devuelve el código de error o 'OK') y
`tests.err_message`. Ver `supabase/tests/000-setup.test.sql`.

## App (src/)

- `src/proxy.ts`: resuelve el host (`src/lib/tenancy`) y reescribe
  `{slug}.giroa.com.ar/x` → `/s/{slug}/x`. Subdominios reservados: www, app, api,
  admin. `/api/*` no se reescribe.
- Rutas: `(marketing)` landing en giroa.com.ar · `(platform)` login/onboarding en
  app.giroa.com.ar · `s/[slug]` público, app del alumno (`/app`) y panel (`/panel`).
- Toda escritura por Server Actions o Route Handlers, con input validado con zod.
- Tipos de la base: `npm run db:types` → `src/types/database.ts` (generado,
  no editar).

## Comandos

```bash
npm run db:start    # Supabase local (requiere Docker Desktop)
npm run db:reset    # migraciones + seed
npm run db:test     # tests pgTAP
npm run db:types    # regenerar tipos
npm run dev         # http://app.lvh.me:3000 · estudios en http://{slug}.lvh.me:3000
npm test            # Vitest
npm run typecheck && npm run lint
```

## Gotchas aprendidos

- No correr `next typegen` ni `next build` con `next dev` prendido: comparten `.next` y el dev
  empieza a dar 404 en rutas anidadas. Si pasa: frenar dev, `rm -rf .next`, volver a arrancar.
- Tailwind 4: las fuentes custom se registran en `@theme` (`--font-serif`) y se usan como
  `font-serif`. La sintaxis de fuente arbitraria de Tailwind 3 (corchetes con family-name) no
  funciona. Ojo: Tailwind escanea TODOS los archivos, incluidos los .md; no escribas clases
  inválidas literales en la documentación porque rompen el CSS de toda la app.
- Formularios con server actions: usar `ActionForm` (`src/components/ui/action-form.tsx`), que no
  resetea los campos si hay error de validación.
- En producción el magic link necesita SMTP propio en Supabase (ver `docs/deploy.md`).
- `supabase projects api-keys` devuelve la secret key **enmascarada** salvo con `--reveal`: nunca
  copiar esa salida a Vercel sin revisar.
- En plpgsql, no uses `if ... case ... end then` en la misma línea: el separador de sentencias de la
  CLI de Supabase lo corta mal ("syntax error at end of input"). Calculá el `case` en una variable antes.
- Deploy: `docs/deploy.md`. Estudio demo: `supabase/seed-demo.sql`.
