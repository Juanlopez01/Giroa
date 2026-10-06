# Deploy de Giroa (Supabase + Vercel + dominio)

Reemplazá `TUDOMINIO.com` por el dominio real en todos los pasos.

## 1. Supabase (base de datos en la nube)

1. En https://supabase.com/dashboard creá un proyecto nuevo, región **São Paulo** (la más cercana).
   Guardá la contraseña de la base.
2. En tu compu, vinculá el proyecto y subí las migraciones:
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF_DEL_PROYECTO>
   npx supabase db push
   ```
   (El ref está en la URL del proyecto: `https://supabase.com/dashboard/project/<REF>`.)
3. **Authentication → URL Configuration**
   - Site URL: `https://app.TUDOMINIO.com`
   - Redirect URLs: `https://app.TUDOMINIO.com/**` y `https://*.TUDOMINIO.com/**`
4. **Authentication → Emails → SMTP**: configurá un SMTP propio (por ejemplo Resend, gratis hasta
   100 mails por día). Sin esto, Supabase solo manda el magic link a los miembros del equipo del
   proyecto y con un límite muy bajo: los alumnos no podrían entrar.
5. **Database → Extensions**: confirmá que `pg_cron` quedó activo (lo activa la migración).
6. Estudio demo: abrí **SQL Editor**, pegá `supabase/seed-demo.sql`, cambiá `owner_email` por tu
   email (después de haber entrado una vez a Giroa) y ejecutalo.
7. Copiá de **Project Settings → API Keys**: la URL del proyecto, la *Publishable key* y la
   *Secret key*.

## 2. Vercel

1. Importá el repo `Juanlopez01/Giroa` en https://vercel.com/new (framework: Next.js).
2. **Environment Variables** (Production):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key (solo servidor) |
   | `NEXT_PUBLIC_ROOT_DOMAIN` | `TUDOMINIO.com` |
   | `NEXT_PUBLIC_COOKIE_DOMAIN` | `.TUDOMINIO.com` |
   | `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (uno nuevo, distinto al local) |
   | `OAUTH_STATE_SECRET` | `openssl rand -base64 48` |
   | `CRON_SECRET` | `openssl rand -base64 48` |
   | `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | credenciales de producción de la app de MP |
   | `MP_WEBHOOK_SECRET` | clave secreta de Webhooks de la app de MP (paso 4) |
| `MP_ACCESS_TOKEN` | Access Token de producción de la cuenta de MP de Giroa (cobra las suscripciones) |

3. **Settings → Domains**: agregá `TUDOMINIO.com`, `app.TUDOMINIO.com` y `*.TUDOMINIO.com`.
   El comodín (`*`) exige que el dominio use los **nameservers de Vercel**: Vercel te muestra cuáles
   poner en el lugar donde compraste el dominio.

## 3. Probar

- `https://TUDOMINIO.com` → landing.
- `https://app.TUDOMINIO.com/login` → entrar y crear un estudio.
- `https://demo.TUDOMINIO.com` → estudio demo.

## 4. Mercado Pago

1. En la app de MP (**Tus integraciones → Giroa**):
   - **URL de redireccionamiento (OAuth):** `https://app.TUDOMINIO.com/api/mp/oauth/callback`
   - **Webhooks → Configurar notificaciones:** URL `https://app.TUDOMINIO.com/api/webhooks/mercadopago`,
     eventos **Pagos**, **Planes y suscripciones** (subscription_preapproval y
     subscription_authorized_payment). Copiá la **clave secreta** a `MP_WEBHOOK_SECRET` en Vercel y redeployá.
2. Para probar sin plata real: entrá al panel del estudio con el **usuario de prueba vendedor**,
   vinculá MP desde *Ajustes*, y comprá un pack desde la app del alumno con el **usuario de prueba
   comprador**.
