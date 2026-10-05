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

let cachedServer: z.infer<typeof serverSchema> | undefined;
let cachedMp: z.infer<typeof mercadoPagoSchema> | undefined;

export function serverEnv() {
  cachedServer ??= serverSchema.parse(process.env);
  return cachedServer;
}

// Separado: el proyecto funciona sin MP configurado hasta que se usa.
export function mercadoPagoEnv() {
  cachedMp ??= mercadoPagoSchema.parse(process.env);
  return cachedMp;
}
