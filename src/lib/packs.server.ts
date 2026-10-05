import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseFeatures } from "@/lib/disciplines";

/**
 * ¿El estudio da alguna clase de una disciplina con packs de pareja?
 * Depende del flag couple_packs de la disciplina, no de su nombre.
 */
export async function studioOffersCouplePacks(studioId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offerings")
    .select("disciplines(features)")
    .eq("studio_id", studioId)
    .eq("is_active", true);
  return (data ?? []).some((o) => parseFeatures(o.disciplines?.features).couple_packs);
}

/** "8 clases · 30 días" / "Libre · 30 días" */
export function packSummary(credits: number | null, validityDays: number): string {
  const clases = credits === null ? "Clases libres" : `${credits} ${credits === 1 ? "clase" : "clases"}`;
  return `${clases} · ${validityDays} ${validityDays === 1 ? "día" : "días"}`;
}
