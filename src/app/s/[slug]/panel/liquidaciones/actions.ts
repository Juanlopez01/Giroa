"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { parseArsToCents } from "@/lib/money";
import { fromSupabaseError, type ActionState } from "@/lib/errors";

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
