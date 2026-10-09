import "server-only";
import { createClient } from "@/lib/supabase/server";

// Todo lo que cobró el estudio en un rango: packs, entradas, gift cards, cobros
// de formaciones y aranceles de audición. Lo usan el Inicio del panel y Pagos,
// así los dos números siempre coinciden.

export type IncomeKind = "pack" | "class" | "event" | "gift" | "formation" | "audition";
export type IncomeMethod = "cash" | "transfer" | "mercadopago";

export type IncomeItem = {
  id: string;
  kind: IncomeKind;
  amountCents: number;
  method: IncomeMethod;
  paidAt: string;
  /** Quién pagó (alumno o comprador). */
  who: string;
  /** Ficha del alumno, si es alumno. */
  studentId: string | null;
  /** Qué pagó: "Pack 8 clases", "2 entradas · Milonga", "Cuota 3 · Profesorado". */
  what: string;
  note: string | null;
};

export const INCOME_KIND_LABELS: Record<IncomeKind, string> = {
  pack: "Packs",
  class: "Clases sueltas y workshops",
  event: "Entradas",
  gift: "Gift cards",
  formation: "Formaciones",
  audition: "Audiciones",
};

const CHARGE_LABEL = { enrollment: "Matrícula", installment: "Cuota", full: "Pago total" } as const;

export async function listIncome(studioId: string, from: Date, to: Date): Promise<IncomeItem[]> {
  const supabase = await createClient();
  const range = { from: from.toISOString(), to: to.toISOString() };

  const [packs, events, gifts, charges, auditions, classes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount_cents, method, paid_at, notes, students!payments_studio_id_student_id_fkey(id, full_name), pack_products(name)")
      .eq("studio_id", studioId)
      .eq("status", "approved")
      .gte("paid_at", range.from)
      .lt("paid_at", range.to),
    supabase
      .from("event_orders")
      .select("id, amount_cents, method, paid_at, buyer_name, quantity, student_id, events!event_orders_studio_id_event_id_fkey(title)")
      .eq("studio_id", studioId)
      .eq("status", "paid")
      .gt("amount_cents", 0)
      .gte("paid_at", range.from)
      .lt("paid_at", range.to),
    // Gift cards: el ingreso es el día de la venta (aunque se canjee después).
    supabase
      .from("gift_cards")
      .select("id, amount_cents, method, paid_at, buyer_name, pack_name")
      .eq("studio_id", studioId)
      .in("status", ["active", "redeemed", "expired"])
      .gte("paid_at", range.from)
      .lt("paid_at", range.to),
    supabase
      .from("formation_charges")
      .select(
        "id, kind, number, amount_cents, method, paid_at, notes, formations!formation_charges_studio_id_formation_id_fkey(title), formation_enrollments!formation_charges_studio_id_enrollment_id_fkey(students!formation_enrollments_studio_id_student_id_fkey(id, full_name))",
      )
      .eq("studio_id", studioId)
      .eq("status", "paid")
      .gte("paid_at", range.from)
      .lt("paid_at", range.to),
    supabase
      .from("audition_applications")
      .select(
        "id, fee_cents, method, paid_at, auditions!audition_applications_studio_id_audition_id_fkey(title), students!audition_applications_studio_id_student_id_fkey(id, full_name)",
      )
      .eq("studio_id", studioId)
      .gt("fee_cents", 0)
      .neq("status", "cancelled")
      .gte("paid_at", range.from)
      .lt("paid_at", range.to),
    supabase
      .from("class_purchases")
      .select(
        "id, amount_cents, method, paid_at, notes, students!class_purchases_studio_id_student_id_fkey(id, full_name), sessions!class_purchases_studio_id_session_id_fkey(starts_at, offerings(title, kind))",
      )
      .eq("studio_id", studioId)
      .eq("status", "paid")
      .gte("paid_at", range.from)
      .lt("paid_at", range.to),
  ]);
  for (const r of [packs, events, gifts, charges, auditions, classes]) if (r.error) throw r.error;

  const items: IncomeItem[] = [];
  for (const p of packs.data ?? []) {
    if (!p.paid_at) continue;
    items.push({
      id: p.id,
      kind: "pack",
      amountCents: p.amount_cents,
      method: p.method,
      paidAt: p.paid_at,
      who: p.students?.full_name ?? "Alumno",
      studentId: p.students?.id ?? null,
      what: p.pack_products?.name ?? "Pack",
      note: p.notes,
    });
  }
  for (const o of events.data ?? []) {
    if (!o.paid_at || !o.method) continue;
    items.push({
      id: o.id,
      kind: "event",
      amountCents: o.amount_cents,
      method: o.method,
      paidAt: o.paid_at,
      who: o.buyer_name,
      studentId: o.student_id,
      what: `${o.quantity} ${o.quantity === 1 ? "entrada" : "entradas"} · ${o.events?.title ?? "Evento"}`,
      note: null,
    });
  }
  for (const g of gifts.data ?? []) {
    if (!g.paid_at || !g.method) continue;
    items.push({
      id: g.id,
      kind: "gift",
      amountCents: g.amount_cents,
      method: g.method,
      paidAt: g.paid_at,
      who: g.buyer_name,
      studentId: null,
      what: `Gift card · ${g.pack_name}`,
      note: null,
    });
  }
  for (const c of charges.data ?? []) {
    if (!c.paid_at || !c.method) continue;
    const student = c.formation_enrollments?.students;
    items.push({
      id: c.id,
      kind: "formation",
      amountCents: c.amount_cents,
      method: c.method,
      paidAt: c.paid_at,
      who: student?.full_name ?? "Alumno",
      studentId: student?.id ?? null,
      what: `${CHARGE_LABEL[c.kind]}${c.kind === "installment" ? ` ${c.number}` : ""} · ${c.formations?.title ?? "Formación"}`,
      note: c.notes,
    });
  }
  for (const a of auditions.data ?? []) {
    if (!a.paid_at || !a.method) continue;
    items.push({
      id: a.id,
      kind: "audition",
      amountCents: a.fee_cents,
      method: a.method,
      paidAt: a.paid_at,
      who: a.students?.full_name ?? "Aspirante",
      studentId: a.students?.id ?? null,
      what: `Arancel · ${a.auditions?.title ?? "Audición"}`,
      note: null,
    });
  }
  for (const c of classes.data ?? []) {
    if (!c.paid_at || !c.method) continue;
    const o = c.sessions?.offerings;
    items.push({
      id: c.id,
      kind: "class",
      amountCents: c.amount_cents,
      method: c.method,
      paidAt: c.paid_at,
      who: c.students?.full_name ?? "Alumno",
      studentId: c.students?.id ?? null,
      what: `${o?.kind === "special" ? "Workshop" : "Clase suelta"} · ${o?.title ?? "Clase"}`,
      note: c.notes,
    });
  }
  return items.sort((x, y) => y.paidAt.localeCompare(x.paidAt));
}
