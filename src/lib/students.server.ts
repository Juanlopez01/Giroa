import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BalanceSummary = { unlimited: boolean; credits: number; nextExpiry: string | null };

/** Saldo usable por alumno (suma de packs vigentes, propios o de pareja). */
export async function balancesByStudent(studioId: string): Promise<Map<string, BalanceSummary>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_balances")
    .select("student_id, partner_student_id, credits_remaining, expires_on, is_usable")
    .eq("studio_id", studioId)
    .eq("is_usable", true);

  const map = new Map<string, BalanceSummary>();
  for (const b of data ?? []) {
    for (const id of [b.student_id, b.partner_student_id]) {
      if (!id) continue;
      const current = map.get(id) ?? { unlimited: false, credits: 0, nextExpiry: null };
      if (b.credits_remaining === null) current.unlimited = true;
      else current.credits += b.credits_remaining;
      if (b.expires_on && (!current.nextExpiry || b.expires_on < current.nextExpiry)) current.nextExpiry = b.expires_on;
      map.set(id, current);
    }
  }
  return map;
}

/** "6 clases · vence 12/11" / "Libre · vence 12/11" / "Sin saldo" */
export function formatBalance(b: BalanceSummary | undefined): string {
  if (!b) return "Sin saldo";
  const amount = b.unlimited ? "Libre" : `${b.credits} ${b.credits === 1 ? "clase" : "clases"}`;
  if (!b.nextExpiry) return amount;
  const [, m, d] = b.nextExpiry.split("-").map(Number);
  return `${amount} · vence ${d}/${m}`;
}
