import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { parseFeatures, type DisciplineOption } from "@/lib/disciplines";

/** Catálogo global de disciplinas activas. */
export const listDisciplines = cache(async (): Promise<DisciplineOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("disciplines")
    .select("key, name, features")
    .eq("is_active", true)
    .order("sort");
  return (data ?? []).map((d) => ({ key: d.key, name: d.name, features: parseFeatures(d.features) }));
});
