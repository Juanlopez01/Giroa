"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { parseArsToCents } from "@/lib/money";
import type { PendingKind } from "@/lib/charge.server";

// "Cobrar": todo lo que se cobra en el mostrador desde una sola pantalla. Cada
// venta usa la RPC de siempre (que valida permiso de cobro, precios y cupos).

const method = z.enum(["cash", "transfer"], { error: "Elegí cómo pagó." });
const uuid = z.uuid();

async function staff(slug: string) {
  const ctx = await requireStaff(slug, "/panel/cobrar");
  return ctx;
}

function done(slug: string, message: string): ActionState {
  revalidatePath(`/s/${slug}/panel`, "layout");
  return { ok: true, message };
}

/** Cobrar algo pendiente: cuota o matrícula de formación, clase reservada sin pagar o arancel. */
export async function payPending(slug: string, kind: PendingKind, id: string, payMethod: "cash" | "transfer"): Promise<ActionState> {
  await staff(slug);
  if (!uuid.safeParse(id).success || !method.safeParse(payMethod).success) return { ok: false, message: "No encontramos ese cobro." };
  const supabase = await createClient();
  const { error } =
    kind === "formation"
      ? await supabase.rpc("record_formation_payment", { p_charge_id: id, p_method: payMethod })
      : kind === "class"
        ? await supabase.rpc("record_class_payment", { p_purchase_id: id, p_method: payMethod })
        : await supabase.rpc("record_audition_payment", { p_application_id: id, p_method: payMethod });
  if (error) return fromSupabaseError(error, "payPending");
  return done(slug, "Cobrado ✓");
}

const packSchema = z.object({
  packId: uuid.or(z.literal("").transform(() => null)).refine((v) => v, "Elegí un pack."),
  partnerId: z.union([uuid, z.literal("")]).optional(),
  amount: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  method,
});

export async function sellPack(slug: string, studentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await staff(slug);
  const parsed = packSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !uuid.safeParse(studentId).success) {
    return { ok: false, fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error.issues) };
  }
  const d = parsed.data;
  let amount: number | undefined;
  if (d.amount?.trim()) {
    const cents = parseArsToCents(d.amount);
    if (cents === null) return { ok: false, fieldErrors: { amount: "Poné el monto en pesos (por ejemplo 29.900)." } };
    amount = cents;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_payment", {
    p_student_id: studentId,
    p_pack_product_id: d.packId!,
    p_method: d.method,
    p_amount_cents: amount,
    p_notes: d.notes || undefined,
    p_partner_student_id: d.partnerId || undefined,
  });
  if (error) return fromSupabaseError(error, "sellPack");
  return done(slug, "¡Listo! Pago registrado y pack acreditado.");
}

const classSchema = z.object({
  sessionId: uuid.or(z.literal("").transform(() => null)).refine((v) => v, "Elegí la clase."),
  role: z.enum(["leader", "follower", ""]).optional(),
  method,
});

export async function sellClass(slug: string, studentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await staff(slug);
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !uuid.safeParse(studentId).success) {
    return { ok: false, fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error.issues) };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("sell_class_manual", {
    p_session_id: d.sessionId!,
    p_student_id: studentId,
    p_method: d.method,
    p_role: d.role || undefined,
  });
  if (error) return fromSupabaseError(error, "sellClass");
  return done(slug, "¡Listo! Clase cobrada y lugar reservado.");
}

const buyer = {
  buyerName: z.string().trim().min(2, "Poné el nombre de quien compra.").max(120),
  buyerEmail: z.union([z.email("Revisá el email."), z.literal("")]).optional(),
};

const ticketSchema = z.object({
  ticketTypeId: uuid.or(z.literal("").transform(() => null)).refine((v) => v, "Elegí la entrada."),
  quantity: z.coerce.number().int().min(1, "Mínimo 1.").max(20, "Hasta 20 por venta."),
  method,
  ...buyer,
});

export async function sellTickets(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await staff(slug);
  const parsed = ticketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("sell_event_tickets_manual", {
    p_ticket_type_id: d.ticketTypeId!,
    p_quantity: d.quantity,
    p_buyer_name: d.buyerName,
    p_buyer_email: d.buyerEmail || undefined,
    p_method: d.method,
  });
  if (error) return fromSupabaseError(error, "sellTickets");
  return done(slug, d.buyerEmail ? "¡Listo! Las entradas le llegan por mail." : "¡Listo! Entradas vendidas.");
}

const giftSchema = z.object({
  packId: uuid.or(z.literal("").transform(() => null)).refine((v) => v, "Elegí el pack de regalo."),
  recipientName: z.string().trim().max(120).optional(),
  method,
  ...buyer,
});

export async function sellGift(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await staff(slug);
  const parsed = giftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_gift_card_manual", {
    p_pack_product_id: d.packId!,
    p_buyer_name: d.buyerName,
    p_buyer_email: d.buyerEmail || undefined,
    p_recipient_name: d.recipientName || undefined,
    p_method: d.method,
  });
  if (error) return fromSupabaseError(error, "sellGift");
  const code = (data as { code?: string } | null)?.code;
  return done(slug, code ? `¡Listo! Código de la gift card: ${code}` : "¡Listo! Gift card vendida.");
}

const newStudentSchema = z.object({
  fullName: z.string().trim().min(2, "Poné su nombre y apellido.").max(120),
  email: z.email("Poné su email: ahí le llega su cuenta y su compra.").transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  packId: uuid.or(z.literal("").transform(() => null)).refine((v) => v, "Elegí un pack."),
  method,
});

/**
 * Pack a alguien que todavía no es alumno: se lo da de alta con su email (si ese
 * email ya es de un alumno, se usa esa ficha), se cobra y le llegan dos mails:
 * la bienvenida (cómo entrar a la app) y "tu pack está acreditado".
 */
export async function sellPackToNewStudent(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await staff(slug);
  const parsed = newStudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("students")
    .select("id, full_name, user_id")
    .eq("studio_id", studio.id)
    .ilike("email", d.email)
    .maybeSingle();
  let studentId = existing?.id;
  if (!studentId) {
    const { data: created, error } = await supabase
      .from("students")
      .insert({ studio_id: studio.id, full_name: d.fullName, email: d.email, phone: d.phone || null })
      .select("id")
      .single();
    if (error) return fromSupabaseError(error, "sellPackToNewStudent.create");
    studentId = created.id;
  }

  const { error: payError } = await supabase.rpc("record_manual_payment", {
    p_student_id: studentId,
    p_pack_product_id: d.packId!,
    p_method: d.method,
  });
  if (payError) return fromSupabaseError(payError, "sellPackToNewStudent.pay");

  // La bienvenida, si todavía no entró nunca a la app (una sola vez por alumno).
  if (!existing?.user_id) {
    const { error: mailError } = await supabase.rpc("send_student_welcome", { p_student_id: studentId });
    if (mailError) console.error("[sellPackToNewStudent.welcome]", mailError);
  }

  return done(
    slug,
    existing
      ? `${existing.full_name} ya era alumno/a: le cargamos el pack y le avisamos por mail.`
      : `¡Listo! ${d.fullName} ya es alumno/a: le mandamos un mail para entrar a la app y otro con su pack.`,
  );
}
