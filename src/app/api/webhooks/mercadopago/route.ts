import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { mercadoPagoEnv } from "@/lib/env.server";
import { verifyMpSignature } from "@/lib/mp/signature";
import { getPayment } from "@/lib/mp/api";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { cancelPreapproval, decodeRef, getAuthorizedPayment, getPreapproval } from "@/lib/mp/subscriptions";
import { EVENT_REF_PREFIX } from "@/lib/events";

// Webhook de Mercado Pago. Nunca se confía en el body:
//   1. se valida la firma x-signature,
//   2. se consulta el recurso a la API de MP,
//   3. se aplica con una RPC idempotente.
// Topics:
//   payment                          → venta de un pack o de entradas de un estudio (?studio=…)
//   subscription_preapproval         → suscripción de un estudio a Giroa
//   subscription_authorized_payment  → cobro periódico de esa suscripción
// Si algo falla se responde 500 para que MP reintente.
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const body = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };

  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? "";
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id !== undefined ? String(body.data.id) : null);
  const requestId = request.headers.get("x-request-id");

  const valid = verifyMpSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId,
    dataId,
    secret: mercadoPagoEnv().MP_WEBHOOK_SECRET,
  });
  if (!valid) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  const studioId = z.uuid().safeParse(url.searchParams.get("studio"));
  const handled =
    (topic === "payment" && studioId.success) ||
    topic === "subscription_preapproval" ||
    topic === "subscription_authorized_payment";
  if (!dataId || !handled) return NextResponse.json({ ignored: true });

  const admin = createAdminClient();

  // Registro del evento (auditoría). Un reintento con el mismo x-request-id
  // reusa la fila; si ya se procesó sin error, se ignora.
  let eventId: number | null = null;
  const { data: inserted, error: insertError } = await admin
    .from("mp_webhook_events")
    .insert({
      studio_id: studioId.success ? studioId.data : null,
      request_id: requestId,
      topic,
      resource_id: dataId,
      payload: body as never,
    })
    .select("id")
    .single();
  if (inserted) {
    eventId = inserted.id;
  } else if (insertError?.code === "23505" && requestId) {
    const { data: existing } = await admin
      .from("mp_webhook_events")
      .select("id, processed_at, error")
      .eq("request_id", requestId)
      .maybeSingle();
    if (existing?.processed_at && !existing.error) return NextResponse.json({ duplicate: true });
    eventId = existing?.id ?? null;
  }

  const finish = async (error: string | null) => {
    if (eventId !== null) {
      await admin.from("mp_webhook_events").update({ processed_at: new Date().toISOString(), error }).eq("id", eventId);
    }
  };

  try {
    if (topic === "payment" && studioId.success) {
      await handlePackPayment(admin, studioId.data, dataId);
    } else if (topic === "subscription_preapproval") {
      await handlePreapproval(admin, dataId);
    } else {
      await handleSubscriptionCharge(admin, dataId);
    }
    await finish(null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mp webhook]", topic, error);
    await finish(error instanceof Error ? error.message : JSON.stringify(error));
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

type Admin = ReturnType<typeof createAdminClient>;

/** Venta de un pack: se consulta con el token DEL ESTUDIO. */
async function handlePackPayment(admin: Admin, studioId: string, paymentId: string) {
  const token = await getStudioAccessToken(studioId);
  if (!token) throw new Error("El estudio no tiene Mercado Pago vinculado");

  const payment = await getPayment(token, paymentId);
  if (!payment.external_reference) throw new Error("Pago sin external_reference");

  // Compra de entradas de un evento ("evento:<uuid>") o pack (uuid solo).
  const isEvent = payment.external_reference.startsWith(EVENT_REF_PREFIX);
  const { error } = await admin.rpc(isEvent ? "mp_apply_event_payment" : "mp_apply_payment", {
    p_external_reference: isEvent
      ? payment.external_reference.slice(EVENT_REF_PREFIX.length)
      : payment.external_reference,
    p_mp_payment_id: payment.id,
    p_mp_status: payment.status,
    p_amount_cents: Math.round(payment.transaction_amount * 100),
    p_paid_at: payment.date_approved ?? undefined,
  });
  if (error) throw error;
}

/** Suscripción a Giroa autorizada, pausada o cancelada (token de Giroa). */
async function handlePreapproval(admin: Admin, preapprovalId: string) {
  const pre = await getPreapproval(preapprovalId);
  const ref = decodeRef(pre.external_reference);
  if (!ref) return; // no es una suscripción de Giroa

  const amount = Math.round((pre.auto_recurring?.transaction_amount ?? 0) * 100);
  const { data: quote } = await admin.rpc("giroa_quote", {
    p_plan: ref.plan,
    p_cycle: ref.cycle,
    p_coupon: ref.coupon ?? undefined,
  });

  const { data, error } = await admin.rpc("giroa_apply_preapproval", {
    p_studio_id: ref.studioId,
    p_preapproval_id: pre.id,
    p_status: pre.status,
    p_plan: ref.plan,
    p_cycle: ref.cycle,
    p_amount_cents: amount,
    p_discount_pct: ((quote as { discount_pct?: number } | null)?.discount_pct ?? 0) as number,
    // Sin código va null (el tipo generado no lo refleja, la función lo acepta).
    p_coupon: ref.coupon as string,
    p_next_payment_at: pre.next_payment_date ?? undefined,
  });
  if (error) throw error;

  // Cambio de plan: la suscripción nueva reemplaza a la vieja → se cancela la vieja.
  const previous = (data as { previous_preapproval_id?: string | null } | null)?.previous_preapproval_id;
  if (previous) await cancelPreapproval(previous).catch((e) => console.error("[mp webhook] cancelar anterior", e));
}

/** Cobro periódico de la suscripción: aprobado → activo; rechazado → gracia. */
async function handleSubscriptionCharge(admin: Admin, authorizedPaymentId: string) {
  const charge = await getAuthorizedPayment(authorizedPaymentId);
  const approved = charge.payment?.status === "approved";
  const rejected = charge.payment?.status === "rejected" || charge.status === "recycling";
  if (!approved && !rejected) return; // todavía en proceso

  let next: string | undefined;
  if (approved) next = (await getPreapproval(charge.preapproval_id)).next_payment_date ?? undefined;

  const { error } = await admin.rpc("giroa_apply_subscription_charge", {
    p_preapproval_id: charge.preapproval_id,
    p_approved: approved,
    p_next_payment_at: next,
  });
  if (error) throw error;
}
