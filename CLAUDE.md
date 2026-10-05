@AGENTS.md

# Giroa

SaaS B2B multi-tenant para estudios de danza y disciplinas de movimiento
(tango, salsa, yoga, pilates…). Mercado inicial: Argentina.

Stack: Next.js 16 (App Router, `src/proxy.ts` reemplaza al middleware) +
TypeScript estricto + Tailwind 4 · Supabase (Postgres, Auth con magic link,
Storage, RLS) · Mercado Pago marketplace (OAuth) · Vercel con `*.giroa.app`.

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
- El bloqueo por deuda aplica solo a cuotas de formaciones (Fase 2): si al
  día 10 del mes no pagó.
- Todo estudio nuevo arranca en plan **Inicial con 14 días de prueba**; el plan
  lo cambia Giroa (service role), nunca el estudio.
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
  `{slug}.giroa.app/x` → `/s/{slug}/x`. Subdominios reservados: www, app, api,
  admin. `/api/*` no se reescribe.
- Rutas: `(marketing)` landing en giroa.app · `(platform)` login/onboarding en
  app.giroa.app · `s/[slug]` público, app del alumno (`/app`) y panel (`/panel`).
- Toda escritura por Server Actions o Route Handlers, con input validado con zod.
- Tipos de la base: `npm run db:types` → `src/types/database.ts` (generado,
  no editar).

## Comandos

```bash
npm run db:start    # Supabase local (requiere Docker Desktop)
npm run db:reset    # migraciones + seed
npm run db:test     # tests pgTAP
npm run db:types    # regenerar tipos
npm run dev         # http://localhost:3000 · estudios en http://{slug}.localhost:3000
npm test            # Vitest
npm run typecheck && npm run lint
```
