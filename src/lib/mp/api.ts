import "server-only";
import { z } from "zod";
import { mercadoPagoEnv } from "@/lib/env.server";

// Cliente mínimo de la API de Mercado Pago (Argentina). Todas las llamadas de
// cobro usan el access token DEL ESTUDIO: la plata va directo a su cuenta.

const API = "https://api.mercadopago.com";
const AUTH = "https://auth.mercadopago.com.ar/authorization";

export class MpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

async function mpFetch(path: string, init: RequestInit & { token?: string }): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new MpError(`Mercado Pago respondió ${res.status} en ${path}`, res.status, body);
  return body;
}

// --- OAuth -------------------------------------------------------------------

export function authorizationUrl(state: string, redirectUri: string): string {
  const { MP_CLIENT_ID } = mercadoPagoEnv();
  const url = new URL(AUTH);
  url.searchParams.set("client_id", MP_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user_id: z.union([z.number(), z.string()]).transform(String),
  public_key: z.string().nullish(),
  live_mode: z.boolean().optional(),
  expires_in: z.number(),
  scope: z.string().nullish(),
});
export type MpTokens = z.infer<typeof tokenSchema>;

export async function exchangeCode(code: string, redirectUri: string): Promise<MpTokens> {
  const { MP_CLIENT_ID, MP_CLIENT_SECRET } = mercadoPagoEnv();
  const body = await mpFetch("/oauth/token", {
    method: "POST",
    body: JSON.stringify({
      client_id: MP_CLIENT_ID,
      client_secret: MP_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  return tokenSchema.parse(body);
}

export async function refreshTokens(refreshToken: string): Promise<MpTokens> {
  const { MP_CLIENT_ID, MP_CLIENT_SECRET } = mercadoPagoEnv();
  const body = await mpFetch("/oauth/token", {
    method: "POST",
    body: JSON.stringify({
      client_id: MP_CLIENT_ID,
      client_secret: MP_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return tokenSchema.parse(body);
}

// --- Checkout Pro ------------------------------------------------------------

const preferenceSchema = z.object({ id: z.string(), init_point: z.string(), sandbox_init_point: z.string().nullish() });

export async function createPreference(
  token: string,
  input: {
    title: string;
    unitPriceCents: number;
    externalReference: string;
    payerEmail: string | null;
    notificationUrl: string;
    backUrl: string;
  },
): Promise<z.infer<typeof preferenceSchema>> {
  const body = await mpFetch("/checkout/preferences", {
    method: "POST",
    token,
    body: JSON.stringify({
      items: [
        {
          title: input.title,
          quantity: 1,
          currency_id: "ARS",
          unit_price: input.unitPriceCents / 100,
        },
      ],
      external_reference: input.externalReference,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      notification_url: input.notificationUrl,
      back_urls: {
        success: `${input.backUrl}?estado=aprobado`,
        pending: `${input.backUrl}?estado=pendiente`,
        failure: `${input.backUrl}?estado=rechazado`,
      },
      auto_return: "approved",
      // Comisión de Giroa: preparada, apagada por ahora (marketplace_fee).
    }),
  });
  return preferenceSchema.parse(body);
}

const paymentSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  external_reference: z.string().nullish(),
  transaction_amount: z.number(),
  date_approved: z.string().nullish(),
});
export type MpPayment = z.infer<typeof paymentSchema>;

export async function getPayment(token: string, paymentId: string): Promise<MpPayment> {
  return paymentSchema.parse(await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`, { method: "GET", token }));
}
