import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Encola el mail de material nuevo y devuelve el texto para el staff. */
export async function notifyNewMaterial(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: "library" | "formation",
  id: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("notify_new_material", { p_kind: kind, p_id: id });
  if (error) {
    console.error("[notifyNewMaterial]", error);
    return "No pudimos mandar el aviso por mail.";
  }
  const n = data ?? 0;
  if (n === 0) return "No hay alumnos para avisarles por mail.";
  return n === 1 ? "Le avisamos por mail a 1 alumno." : `Les avisamos por mail a ${n} alumnos.`;
}
