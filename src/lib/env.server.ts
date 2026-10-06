import "server-only";
import { z } from "zod";

// 32 bytes en base64 (openssl rand -base64 32).
const key32 = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "Tiene que ser una clave de 32 bytes en base64");

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: key32,
  OAUTH_STATE_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
});

const mercadoPagoSchema = z.object({
  MP_CLIENT_ID: z.string().min(1),
  MP_CLIENT_SECRET: z.string().min(1),
  MP_WEBHOOK_SECRET: z.string().min(1),
});

// Cuenta de Mercado Pago de Giroa (cobra las suscripciones de los estudios).
const giroaMpSchema = z.object({ MP_ACCESS_TOKEN: z.string().min(1) });

let cachedServer: z.infer<typeof serverSchema> | undefined;
let cachedMp: z.infer<typeof mercadoPagoSchema> | undefined;
let cachedGiroaMp: z.infer<typeof giroaMpSchema> | undefined;

export function serverEnv() {
  cachedServer ??= serverSchema.parse(process.env);
  return cachedServer;
}

// Separado: el proyecto funciona sin MP configurado hasta que se usa.
export function mercadoPagoEnv() {
  cachedMp ??= mercadoPagoSchema.parse(process.env);
  return cachedMp;
}

/** Access token de la cuenta de MP de Giroa (solo servidor). */
export function giroaMercadoPagoEnv() {
  cachedGiroaMp ??= giroaMpSchema.parse(process.env);
  return cachedGiroaMp;
}
