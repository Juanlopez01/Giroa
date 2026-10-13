"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { parseArsToCents } from "@/lib/money";
import { fromSupabaseError, type ActionState } from "@/lib/errors";
import { loadMonthPayouts } from "@/lib/payouts.server";
import { parseMonth } from "@/lib/payouts";

export type RuleInput = { payeeName: string; memberId: string; kind: string; value: string };

const ruleSchema = z.object({
  payeeName: z.string().trim().min(2, "Poné el nombre de cada profe.").max(120, "Usá un nombre más corto."),
  memberId: z.union([z.uuid(), z.literal("")]),
  kind: z.enum(["per_class", "per_student", "percent"], "Elegí cómo se le paga a cada profe."),
  value: z.string(),
});

/** Reemplaza los profes y lo que cobran en una clase. */
export async function saveRules(slug: string, offeringId: string, rules: RuleInput[]): Promise<ActionState> {
  await requireAdmin(slug, "/panel/liquidaciones/reglas");
  if (!z.uuid().safeParse(offeringId).success) return { ok: false, message: "No encontramos esa clase." };

  const payload = [];
  for (const raw of rules) {
    const parsed = ruleSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisá los datos." };
    const r = parsed.data;
    if (r.kind === "percent") {
      const percent = Number(r.value.replace(",", ".").replace("%", "").trim());
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        return { ok: false, message: `El porcentaje de ${r.payeeName} tiene que ser de 1 a 100.` };
      }
      payload.push({ payee_name: r.payeeName, member_id: r.memberId || null, kind: r.kind, percent: Math.round(percent * 100) / 100 });
    } else {
      const cents = parseArsToCents(r.value);
      if (cents === null) return { ok: false, message: `Poné el monto de ${r.payeeName} en pesos (por ejemplo 15.000).` };
      payload.push({ payee_name: r.payeeName, member_id: r.memberId || null, kind: r.kind, amount_cents: cents });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_payout_rules", { p_offering_id: offeringId, p_rules: payload });
  if (error) return fromSupabaseError(error, "saveRules");
  revalidatePath(`/s/${slug}/panel/liquidaciones`, "layout");
  return { ok: true, message: payload.length ? "¡Listo! Guardamos lo que cobra cada profe." : "Listo: esta clase no se liquida." };
}

const markSchema = z.object({
  month: z.string().refine((v) => parseMonth(v) !== null, "Elegí un mes."),
  payeeKey: z.string().min(1).max(200),
  method: z.enum(["cash", "transfer"], "Elegí si le pagaste en efectivo o por transferencia."),
});

/** Marca pagado el mes de un profe. El monto y el detalle se recalculan acá (no vienen del navegador). */
export async function markPaid(slug: string, month: string, payeeKey: string, method: "cash" | "transfer"): Promise<ActionState> {
  const { studio } = await requireAdmin(slug, "/panel/liquidaciones");
  const parsed = markSchema.safeParse({ month, payeeKey, method });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const d = parsed.data;

  const { payees } = await loadMonthPayouts(studio.id, d.month, studio.timezone);
  const payee = payees.find((p) => p.key === d.payeeKey);
  if (!payee) return { ok: false, message: "No encontramos a ese profe en este mes." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_payout_paid", {
    p_studio_id: studio.id,
    p_period: `${d.month}-01`,
    p_payee_name: payee.name,
    // null = profe sin cuenta (los tipos generados no lo admiten en un parámetro sin default).
    p_member_id: payee.memberId as string,
    p_amount_cents: payee.totalCents,
    p_breakdown: payee.lines,
    p_method: d.method,
  });
  if (error) return fromSupabaseError(error, "markPaid");
  revalidatePath(`/s/${slug}/panel/liquidaciones`);
  return { ok: true, message: `Listo: ${payee.name} figura como pagado.` };
}

export async function undoPayout(slug: string, payoutId: string): Promise<ActionState> {
  await requireAdmin(slug, "/panel/liquidaciones");
  if (!z.uuid().safeParse(payoutId).success) return { ok: false, message: "No encontramos ese pago." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_payout", { p_payout_id: payoutId });
  if (error) return fromSupabaseError(error, "undoPayout");
  revalidatePath(`/s/${slug}/panel/liquidaciones`);
  return { ok: true, message: "Pago deshecho." };
}
