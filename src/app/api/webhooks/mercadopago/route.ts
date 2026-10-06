import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { mercadoPagoEnv } from "@/lib/env.server";
import { verifyMpSignature } from "@/lib/mp/signature";
import { getPayment } from "@/lib/mp/api";
import { getStudioAccessToken } from "@/lib/mp/connections";

// Webhook de Mercado Pago. Nunca se confía en el body:
//   1. se valida la firma x-signature,
//   2. se consulta el pago a la API de MP con el token del estudio,
//   3. se acredita con mp_apply_payment (idempotente).
// Si algo falla se responde 500 para que MP reintente; lo que ya se procesó
// bien no se vuelve a procesar.
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
  if (topic !== "payment" || !dataId) return NextResponse.json({ ignored: true });

  const studioId = z.uuid().safeParse(url.searchParams.get("studio"));
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
    if (!studioId.success) throw new Error("Falta el estudio en la notification_url");
    const token = await getStudioAccessToken(studioId.data);
    if (!token) throw new Error("El estudio no tiene Mercado Pago vinculado");

    // La verdad sale de la API de MP, con el token del estudio.
    const payment = await getPayment(token, dataId);
    if (!payment.external_reference) throw new Error("Pago sin external_reference");

    const { error } = await admin.rpc("mp_apply_payment", {
      p_external_reference: payment.external_reference,
      p_mp_payment_id: payment.id,
      p_mp_status: payment.status,
      p_amount_cents: Math.round(payment.transaction_amount * 100),
      p_paid_at: payment.date_approved ?? undefined,
    });
    if (error) throw error;
    await finish(null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mp webhook]", error);
    await finish(error instanceof Error ? error.message : JSON.stringify(error));
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
