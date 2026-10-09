import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformUrl } from "@/lib/urls";
import { getPayment } from "@/lib/mp/api";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { EVENT_REF_PREFIX } from "@/lib/events";
import { GIFT_REF_PREFIX } from "@/lib/gift-cards";
import { AUDITION_REF_PREFIX, FORMATION_REF_PREFIX } from "@/lib/formations";

/** Clase suelta o workshop pago: external_reference = "clase:<uuid>". */
export const CLASS_REF_PREFIX = "clase:";

/**
 * Aplica un pago de Checkout Pro de un estudio. Nunca se confía en quien avisa:
 * el pago se consulta a la API de MP con el token DEL ESTUDIO (un id de otra
 * cuenta no existe para ese token) y las RPC son idempotentes y validan el monto.
 * Lo usan el webhook y las páginas de vuelta de MP.
 */
export async function applyStudioPayment(studioId: string, paymentId: string): Promise<void> {
  const token = await getStudioAccessToken(studioId);
  if (!token) throw new Error("El estudio no tiene Mercado Pago vinculado");

  const payment = await getPayment(token, paymentId);
  const ref = payment.external_reference;
  if (!ref) throw new Error("Pago sin external_reference");

  const admin = createAdminClient();
  const base = {
    p_mp_payment_id: payment.id,
    p_mp_status: payment.status,
    p_amount_cents: Math.round(payment.transaction_amount * 100),
  };

  // Arancel de audición ("audicion:<uuid>"), cobro de formación ("formacion:<uuid>")
  // o gift card ("regalo:<uuid>"): cada uno con su RPC.
  const prefixed = [
    [AUDITION_REF_PREFIX, "mp_apply_audition_payment"],
    [FORMATION_REF_PREFIX, "mp_apply_formation_payment"],
    [GIFT_REF_PREFIX, "mp_apply_gift_payment"],
    [CLASS_REF_PREFIX, "mp_apply_class_payment"],
  ] as const;
  for (const [prefix, rpc] of prefixed) {
    if (ref.startsWith(prefix)) {
      const { error } = await admin.rpc(rpc, { ...base, p_external_reference: ref.slice(prefix.length) });
      if (error) throw error;
      return;
    }
  }

  // Compra de entradas de un evento ("evento:<uuid>") o pack (uuid solo).
  const isEvent = ref.startsWith(EVENT_REF_PREFIX);
  const { error } = await admin.rpc(isEvent ? "mp_apply_event_payment" : "mp_apply_payment", {
    ...base,
    p_external_reference: isEvent ? ref.slice(EVENT_REF_PREFIX.length) : ref,
    p_paid_at: payment.date_approved ?? undefined,
  });
  if (error) throw error;
}

/**
 * Vuelta de Checkout Pro: MP agrega `payment_id` (o `collection_id`) al link.
 * Se confirma el pago en el momento, sin esperar al webhook. Si falla, no rompe
 * la página: el webhook lo vuelve a intentar.
 */
export async function confirmMpReturn(
  studioId: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<void> {
  const raw = searchParams.payment_id ?? searchParams.collection_id;
  const paymentId = typeof raw === "string" ? raw : null;
  if (!paymentId || !/^\d{1,20}$/.test(paymentId)) return;
  try {
    await applyStudioPayment(studioId, paymentId);
  } catch (error) {
    console.error("[mp return]", paymentId, error);
  }
}

/**
 * URL de aviso de los cobros de un estudio. `source_news=webhooks` hace que MP
 * mande solo el formato webhook (firmado) y no el IPN viejo, que no trae firma.
 */
export function studioNotificationUrl(studioId: string): string {
  return platformUrl(`/api/webhooks/mercadopago?studio=${studioId}&source_news=webhooks`);
}
