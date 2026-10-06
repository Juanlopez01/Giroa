"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { addDaysYmd, startOfDay } from "@/lib/datetime";
import { eventInstants, TICKET_QR_PREFIX } from "@/lib/events";
import { eventSchema, manualSaleSchema, ticketTypeSchema } from "@/lib/validation/event";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { getStudioBySlug } from "@/lib/studio.server";
import type { ScanFeedback } from "@/components/panel/qr-scanner";

function readEvent(formData: FormData) {
  return eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    venue: formData.get("venue") ?? "",
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") ?? "",
  });
}

function readTicketType(formData: FormData) {
  return ticketTypeSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price") ?? "",
    quantity: formData.get("quantity") ?? "",
    maxPerOrder: formData.get("maxPerOrder") || 10,
    salesEndDate: formData.get("salesEndDate") ?? "",
  });
}

const refresh = (slug: string) => revalidatePath(`/s/${slug}`, "layout");

export async function createEvent(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readEvent(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const e = parsed.data;
  const { startsAt, endsAt } = eventInstants(e.date, e.startTime, e.endTime, studio.timezone);
  if (startsAt.getTime() < Date.now()) return { ok: false, fieldErrors: { date: "La fecha ya pasó." } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      studio_id: studio.id,
      title: e.title,
      description: e.description,
      venue: e.venue,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      // Se publica recién cuando tenga al menos un tipo de entrada.
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return fromSupabaseError(error, "createEvent");

  refresh(slug);
  redirect(`/panel/eventos/${data.id}?nuevo=1`);
}

export async function updateEvent(slug: string, eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readEvent(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const e = parsed.data;
  const { startsAt, endsAt } = eventInstants(e.date, e.startTime, e.endTime, studio.timezone);

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      title: e.title,
      description: e.description,
      venue: e.venue,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
    })
    .eq("id", eventId)
    .eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "updateEvent");

  refresh(slug);
  return { ok: true, message: "Guardamos los cambios." };
}

export async function setEventStatus(
  slug: string,
  eventId: string,
  status: "draft" | "published" | "cancelled",
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();

  if (status === "published") {
    const { count } = await supabase
      .from("event_ticket_types")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_active", true);
    if (!count) return { ok: false, message: "Agregá al menos un tipo de entrada antes de publicar." };
  }

  const { error } = await supabase.from("events").update({ status }).eq("id", eventId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "setEventStatus");
  refresh(slug);
  return {
    ok: true,
    message:
      status === "published"
        ? "¡Publicado! Ya podés compartir el link."
        : status === "cancelled"
          ? "Cancelaste el evento. Las entradas vendidas no se reintegran solas: avisales a quienes compraron."
          : "Lo pasaste a borrador: ya no se ve ni se venden entradas.",
  };
}

export async function deleteEvent(slug: string, eventId: string): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { count } = await supabase
    .from("event_orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (count) return { ok: false, message: "Este evento ya tiene compras: en vez de borrarlo, cancelalo." };

  const { error } = await supabase.from("events").delete().eq("id", eventId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "deleteEvent");
  refresh(slug);
  redirect("/panel/eventos");
}

function ticketTypeRow(input: z.infer<typeof ticketTypeSchema>, timeZone: string) {
  return {
    name: input.name,
    price_cents: input.price,
    quantity: input.quantity,
    max_per_order: input.maxPerOrder,
    // "Venta hasta el 9/10" = hasta el final de ese día, hora del estudio.
    sales_end_at: input.salesEndDate ? startOfDay(addDaysYmd(input.salesEndDate, 1), timeZone).toISOString() : null,
  };
}

export async function createTicketType(slug: string, eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readTicketType(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_ticket_types")
    .insert({ ...ticketTypeRow(parsed.data, studio.timezone), studio_id: studio.id, event_id: eventId });
  if (error) return fromSupabaseError(error, "createTicketType");
  refresh(slug);
  return { ok: true, message: "Agregamos la entrada." };
}

export async function updateTicketType(
  slug: string,
  ticketTypeId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readTicketType(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_ticket_types")
    .update(ticketTypeRow(parsed.data, studio.timezone))
    .eq("id", ticketTypeId)
    .eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "updateTicketType");
  refresh(slug);
  return { ok: true, message: "Guardamos los cambios. Las entradas ya vendidas mantienen su precio." };
}

export async function setTicketTypeActive(slug: string, ticketTypeId: string, active: boolean): Promise<void> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  await supabase.from("event_ticket_types").update({ is_active: active }).eq("id", ticketTypeId).eq("studio_id", studio.id);
  refresh(slug);
}

// --------------------------------------------------------------- ventas y puerta

export async function sellManual(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(slug);
  const parsed = manualSaleSchema.safeParse({
    ticketTypeId: formData.get("ticketTypeId"),
    quantity: formData.get("quantity"),
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    method: formData.get("method"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const s = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("sell_event_tickets_manual", {
    p_ticket_type_id: s.ticketTypeId,
    p_quantity: s.quantity,
    p_buyer_name: s.name,
    p_method: s.method,
    p_buyer_email: s.email ?? undefined,
  });
  if (error) return fromSupabaseError(error, "sellManual");
  refresh(slug);
  return { ok: true, message: `Listo: ${s.quantity === 1 ? "1 entrada vendida" : `${s.quantity} entradas vendidas`}.` };
}

export async function cancelOrder(slug: string, orderId: string): Promise<ActionState> {
  await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_event_order", { p_order_id: orderId });
  if (error) return fromSupabaseError(error, "cancelOrder");
  refresh(slug);
  return { ok: true, message: "Compra cancelada. Si correspondía, hacé el reintegro desde Mercado Pago." };
}

/** Lector de QR en la puerta. Acepta "giroa-entrada:<token>" o el token solo. */
export async function scanTicket(slug: string, eventId: string, scanned: string): Promise<ScanFeedback> {
  await requireStaff(slug);
  const raw = scanned.trim();
  if (raw.startsWith("giroa:")) return { kind: "error", text: "Ese es el QR de alumno, no una entrada." };
  const token = raw.startsWith(TICKET_QR_PREFIX) ? raw.slice(TICKET_QR_PREFIX.length) : raw;
  if (!z.uuid().safeParse(eventId).success || !/^[a-f0-9]{32}$/.test(token)) {
    return { kind: "error", text: "Ese QR no es una entrada de Giroa." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_ticket", { p_event_id: eventId, p_qr_token: token });
  if (error) return { kind: "error", text: fromSupabaseError(error, "scanTicket").message ?? "No pudimos validar la entrada." };

  const r = data as { already_checked_in: boolean; buyer_name: string; ticket_type: string; number: number; quantity: number; checked_in_at: string };
  const who = `${r.buyer_name} · ${r.ticket_type}${r.quantity > 1 ? ` (${r.number} de ${r.quantity})` : ""}`;
  refresh(slug);
  if (r.already_checked_in) {
    const at = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: (await getStudioBySlug(slug))?.timezone }).format(new Date(r.checked_in_at));
    return { kind: "warn", text: `⚠ Ya ingresó a las ${at}: ${who}` };
  }
  return { kind: "ok", text: `✓ Entrada válida: ${who}` };
}
