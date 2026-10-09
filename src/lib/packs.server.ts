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

/**
 * Opciones para las restricciones de un pack: las disciplinas que da el estudio
 * y sus clases regulares activas. null si el plan no incluye packs con restricciones.
 */
export async function packRuleOptions(studioId: string) {
  if (!(await can(studioId, "pack_rules"))) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("offerings")
    .select("id, title, discipline_key, disciplines(name)")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .eq("kind", "regular")
    .order("title");
  const disciplines = new Map<string, string>();
  for (const o of data ?? []) disciplines.set(o.discipline_key, o.disciplines?.name ?? o.discipline_key);
  return {
    disciplines: [...disciplines].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name)),
    offerings: (data ?? []).map((o) => ({ id: o.id, title: o.title })),
  };
}

/** Nombres para describir las restricciones ("Solo Yoga · Lun a Vie"). */
export async function packRuleNames(studioId: string) {
  const supabase = await createClient();
  const [{ data: offerings }, { data: disciplines }] = await Promise.all([
    supabase.from("offerings").select("id, title").eq("studio_id", studioId),
    supabase.from("disciplines").select("key, name"),
  ]);
  return {
    offerings: Object.fromEntries((offerings ?? []).map((o) => [o.id, o.title])),
    disciplines: Object.fromEntries((disciplines ?? []).map((d) => [d.key, d.name])),
  };
}
