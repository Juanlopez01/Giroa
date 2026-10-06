import "server-only";
import { z } from "zod";
import { giroaMercadoPagoEnv } from "@/lib/env.server";

// Suscripciones de los estudios a Giroa (Mercado Pago "preapproval"). Cobran en
// la cuenta de Giroa, con el access token de Giroa (no el de los estudios).

const API = "https://api.mercadopago.com";

async function giroaFetch(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${giroaMercadoPagoEnv().MP_ACCESS_TOKEN}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} en ${path}: ${JSON.stringify(body)}`);
  return body;
}

// external_reference: "giroa|<studioId>|<plan>|<cycle>|<coupon>"
export type SubscriptionRef = { studioId: string; plan: "profe" | "inicial" | "estudio" | "pro"; cycle: "monthly" | "annual"; coupon: string | null };

export function encodeRef(r: SubscriptionRef): string {
  return ["giroa", r.studioId, r.plan, r.cycle, r.coupon ?? ""].join("|");
}

const refSchema = z.object({
  studioId: z.uuid(),
  plan: z.enum(["profe", "inicial", "estudio", "pro"]),
  cycle: z.enum(["monthly", "annual"]),
  coupon: z.string().nullable(),
});

export function decodeRef(ref: string | null | undefined): SubscriptionRef | null {
  const parts = (ref ?? "").split("|");
  if (parts[0] !== "giroa" || parts.length !== 5) return null;
  const parsed = refSchema.safeParse({ studioId: parts[1], plan: parts[2], cycle: parts[3], coupon: parts[4] || null });
  return parsed.success ? parsed.data : null;
}

const preapprovalSchema = z.object({
  id: z.string(),
  status: z.string(),
  init_point: z.string().nullish(),
  external_reference: z.string().nullish(),
  next_payment_date: z.string().nullish(),
  auto_recurring: z.object({ transaction_amount: z.number() }).partial().nullish(),
});
export type Preapproval = z.infer<typeof preapprovalSchema>;

export async function createPreapproval(input: {
  reason: string;
  amountCents: number;
  frequencyMonths: number;
  payerEmail: string;
  backUrl: string;
  ref: SubscriptionRef;
}): Promise<Preapproval> {
  const body = await giroaFetch("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: input.reason,
      external_reference: encodeRef(input.ref),
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: input.frequencyMonths,
        frequency_type: "months",
        transaction_amount: input.amountCents / 100,
        currency_id: "ARS",
      },
    }),
  });
  return preapprovalSchema.parse(body);
}

export async function getPreapproval(id: string): Promise<Preapproval> {
  return preapprovalSchema.parse(await giroaFetch(`/preapproval/${encodeURIComponent(id)}`, { method: "GET" }));
}

export async function cancelPreapproval(id: string): Promise<void> {
  await giroaFetch(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
}

const authorizedPaymentSchema = z.object({
  preapproval_id: z.string(),
  status: z.string(),
  payment: z.object({ status: z.string().nullish() }).nullish(),
});

/** Cobro periódico de una suscripción (topic subscription_authorized_payment). */
export async function getAuthorizedPayment(id: string) {
  return authorizedPaymentSchema.parse(await giroaFetch(`/authorized_payments/${encodeURIComponent(id)}`, { method: "GET" }));
}
