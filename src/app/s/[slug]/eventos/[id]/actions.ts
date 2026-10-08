"use server";

import { studioNotificationUrl } from "@/lib/mp/apply-payment";
import { studioUrl } from "@/lib/urls";
import { redirect } from "next/navigation";
import { getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPreference } from "@/lib/mp/api";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { EVENT_REF_PREFIX } from "@/lib/events";
import { buyTicketsSchema } from "@/lib/validation/event";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

/**
 * Compra de entradas (sin cuenta):
 *  1. create_event_order (RPC) reserva el cupo 20 minutos con el precio del tipo,
 *  2. si es gratis ya queda confirmada → "Tus entradas",
 *  3. si no, preferencia de MP con el token del estudio → Mercado Pago.
 *     El webhook confirma el pago y emite las entradas.
 */
export async function buyTickets(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const studio = await getStudioBySlug(slug);
  if (!studio) return { ok: false, message: "No encontramos el estudio." };

  const parsed = buyTicketsSchema.safeParse({
    ticketTypeId: formData.get("ticketTypeId"),
    quantity: formData.get("quantity"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const b = parsed.data;

  const supabase = await createClient();
  const { data: order, error } = await supabase.rpc("create_event_order", {
    p_ticket_type_id: b.ticketTypeId,
    p_quantity: b.quantity,
    p_buyer_name: b.name,
    p_buyer_email: b.email,
    p_buyer_phone: b.phone ?? undefined,
    p_coupon: String(formData.get("coupon") ?? "").trim() || undefined,
  });
  if (error) return fromSupabaseError(error, "buyTickets");

  const ticketsUrl = `/entradas/${order.access_token}`;
  if (order.status === "paid") redirect(ticketsUrl);

  let initPoint: string;
  try {
    const token = await getStudioAccessToken(studio.id);
    if (!token) return { ok: false, message: "Este estudio todavía no cobra online. Consultá en el estudio cómo comprar." };

    const admin = createAdminClient();
    const { data: info } = await admin
      .from("event_orders")
      .select("events(title), event_ticket_types(name)")
      .eq("id", order.id)
      .single();
    const title = `${order.quantity} × ${info?.event_ticket_types?.name ?? "Entrada"} · ${info?.events?.title ?? "Evento"}`;

    const preference = await createPreference(token, {
      title,
      unitPriceCents: order.amount_cents,
      externalReference: `${EVENT_REF_PREFIX}${order.external_reference}`,
      payerEmail: b.email,
      notificationUrl: studioNotificationUrl(studio.id),
      backUrl: studioUrl(slug, ticketsUrl),
    });
    await admin.from("event_orders").update({ mp_preference_id: preference.id }).eq("id", order.id);
    initPoint = preference.init_point;
  } catch (e) {
    console.error("[buyTickets]", e);
    // Libera el cupo reservado: la compra no llegó a Mercado Pago.
    await createAdminClient().from("event_orders").update({ status: "cancelled" }).eq("id", order.id).eq("status", "pending");
    return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  }

  redirect(initPoint);
}
