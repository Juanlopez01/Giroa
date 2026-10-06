import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseFeatures, type DisciplineFeatures } from "@/lib/disciplines";
import { can } from "@/lib/gating";

/**
 * ¿El estudio da alguna clase activa de una disciplina con este flag?
 * (p. ej. couple_packs para ofrecer packs de pareja, role_balance para pedir
 * el rol del alumno). Depende del flag, nunca del nombre de la disciplina.
 */
export async function studioOffersFeature(studioId: string, feature: keyof DisciplineFeatures): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offerings")
    .select("disciplines(features)")
    .eq("studio_id", studioId)
    .eq("is_active", true);
  return (data ?? []).some((o) => parseFeatures(o.disciplines?.features)[feature]);
}

export async function studioOffersCouplePacks(studioId: string): Promise<boolean> {
  return (await can(studioId, "couple_packs")) && (await studioOffersFeature(studioId, "couple_packs"));
}

/** "8 clases · 30 días" / "Clases libres · 30 días" */
export function packSummary(credits: number | null, validityDays: number): string {
  const clases = credits === null ? "Clases libres" : `${credits} ${credits === 1 ? "clase" : "clases"}`;
  return `${clases} · ${validityDays} ${validityDays === 1 ? "día" : "días"}`;
}
