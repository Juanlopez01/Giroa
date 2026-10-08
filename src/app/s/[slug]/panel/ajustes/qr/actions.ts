"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fromSupabaseError, type ActionState } from "@/lib/errors";

/** Cambia el QR de asistencia: los carteles impresos antes dejan de valer. */
export async function rotateCheckinCode(slug: string): Promise<ActionState> {
  const { studio } = await requireAdmin(slug, "/panel/ajustes/qr");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_checkin_code", { p_studio_id: studio.id });
  if (error) return fromSupabaseError(error, "rotateCheckinCode");
  revalidatePath(`/s/${slug}/panel/ajustes/qr`);
  return { ok: true, message: "Listo: imprimí el cartel nuevo. El anterior ya no sirve." };
}
