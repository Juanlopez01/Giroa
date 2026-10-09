import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { MpError } from "@/lib/mp/api";
import { getAuthorizedPayment, getPreapproval, preapprovalFetch, preapprovalSchema, type Preapproval } from "@/lib/mp/subscriptions";
import { membershipChargeError } from "@/lib/memberships";

// Abonos mensuales de los alumnos: débito automático de MP (preapproval) en la
// cuenta DEL ESTUDIO, con su token. external_reference = "abono:<uuid>".
// Como en los pagos, nunca se confía en quien avisa: todo se consulta a la API.

export const MEMBERSHIP_REF_PREFIX = "abono:";

export async function createMembershipPreapproval(
  token: string,
  input: { subscriptionId: string; reason: string; amountCents: number; payerEmail: string; backUrl: string },
): Promise<Preapproval> {
  const body = await preapprovalFetch(
    "/preapproval",
    {
      method: "POST",
      body: JSON.stringify({
        reason: input.reason,
        external_reference: MEMBERSHIP_REF_PREFIX + input.subscriptionId,
        payer_email: input.payerEmail,
        back_url: input.backUrl,
        status: "pending",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: input.amountCents / 100,
          currency_id: "ARS",
        },
      }),
    },
    token,
  );
  return preapprovalSchema.parse(body);
}

/** ¿De qué estudio es este débito? Primero por el id guardado; si no, por la cuenta de MP que avisa. */
export async function membershipStudioFor(preapprovalId: string | null, mpUserId: string | null): Promise<string | null> {
  const admin = createAdminClient();
  if (preapprovalId) {
    const { data } = await admin.from("student_subscriptions").select("studio_id").eq("mp_preapproval_id", preapprovalId).maybeSingle();
    if (data) return data.studio_id;
  }
  if (mpUserId) {
    const { data } = await admin.from("mp_connections").select("studio_id").eq("mp_user_id", mpUserId).maybeSingle();
    if (data) return data.studio_id;
  }
  return null;
}

/** Estado del débito (autorizado, pausado, cancelado). false si no es un abono de este estudio. */
export async function applyMembershipPreapproval(studioId: string, preapprovalId: string): Promise<boolean> {
  const token = await getStudioAccessToken(studioId);
  if (!token) throw new Error("El estudio no tiene Mercado Pago vinculado");

  let pre;
  try {
    pre = await getPreapproval(preapprovalId, token);
  } catch (error) {
    if (error instanceof MpError && (error.status === 404 || error.status === 403)) return false;
    throw error;
  }
  const ref = pre.external_reference ?? "";
  if (!ref.startsWith(MEMBERSHIP_REF_PREFIX)) return false;
  const subscriptionId = ref.slice(MEMBERSHIP_REF_PREFIX.length);

  const admin = createAdminClient();
  const { data: sub } = await admin.from("student_subscriptions").select("studio_id").eq("id", subscriptionId).maybeSingle();
  if (!sub || sub.studio_id !== studioId) return false;

  const { error } = await admin.rpc("mp_apply_membership", {
    p_subscription_id: subscriptionId,
    p_preapproval_id: pre.id,
    p_status: pre.status,
    p_next_charge_at: pre.next_payment_date ?? undefined,
  });
  if (error) throw error;
  return true;
}

/** Un cobro mensual. false si el cobro no es de un abono de este estudio. */
export async function applyMembershipCharge(studioId: string, authorizedPaymentId: string): Promise<boolean> {
  const token = await getStudioAccessToken(studioId);
  if (!token) throw new Error("El estudio no tiene Mercado Pago vinculado");

  let charge;
  try {
    charge = await getAuthorizedPayment(authorizedPaymentId, token);
  } catch (error) {
    // Un cobro de otra cuenta no existe para este token.
    if (error instanceof MpError && (error.status === 404 || error.status === 403)) return false;
    throw error;
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("student_subscriptions")
    .select("studio_id")
    .eq("mp_preapproval_id", charge.preapproval_id)
    .maybeSingle();
  if (!sub || sub.studio_id !== studioId) return false;

  const status = charge.payment?.status;
  const approved = status === "approved";
  const rejected = status === "rejected" || charge.status === "recycling";
  if (!approved && !rejected) return true; // todavía en proceso

  const next = approved ? (await getPreapproval(charge.preapproval_id, token)).next_payment_date : null;
  const { error } = await admin.rpc("mp_apply_membership_charge", {
    p_preapproval_id: charge.preapproval_id,
    // El pago de MP; si no viene, el id del cobro (igual sirve para no duplicar).
    p_mp_payment_id: charge.payment?.id ?? `debito:${charge.id}`,
    p_approved: approved,
    p_amount_cents: Math.round((charge.transaction_amount ?? 0) * 100), // 0 = el monto del abono
    p_paid_at: approved ? (charge.debit_date ?? undefined) : undefined,
    p_next_charge_at: next ?? undefined,
    p_error: approved ? undefined : membershipChargeError(charge.payment?.status_detail),
  });
  if (error) throw error;
  return true;
}

/**
 * Vuelta de MP después de autorizar el débito: trae `preapproval_id`. Se aplica
 * en el momento (sin esperar al webhook). Si falla, no rompe la página.
 */
export async function confirmMembershipReturn(
  studioId: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<void> {
  const raw = searchParams.preapproval_id;
  const id = typeof raw === "string" ? raw : null;
  if (!id || !/^[A-Za-z0-9-]{6,64}$/.test(id)) return;
  try {
    await applyMembershipPreapproval(studioId, id);
  } catch (error) {
    console.error("[mp abono return]", id, error);
  }
}
