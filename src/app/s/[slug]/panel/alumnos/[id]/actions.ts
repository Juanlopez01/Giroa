"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fromSupabaseError, type ActionState } from "@/lib/errors";
import { isYmd } from "@/lib/datetime";

/** Congelar un pack (la base valida permiso de cobro, plan y que esté vigente). */
export async function freezeStudentPack(slug: string, studentId: string, packId: string, until: string | null): Promise<ActionState> {
  await requireStaff(slug);
  if (!z.uuid().safeParse(packId).success) return { ok: false, message: "No encontramos ese pack." };
  if (until && !isYmd(until)) return { ok: false, message: "Revisá la fecha." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("freeze_pack", { p_pack_id: packId, p_until: until ?? undefined });
  if (error) return fromSupabaseError(error, "freezePack");
  revalidatePath(`/s/${slug}/panel/alumnos/${studentId}`);
  return { ok: true, message: "Pack congelado. Al descongelarlo, el vencimiento se corre por los días que estuvo pausado." };
}

export async function unfreezeStudentPack(slug: string, studentId: string, packId: string): Promise<ActionState> {
  await requireStaff(slug);
  if (!z.uuid().safeParse(packId).success) return { ok: false, message: "No encontramos ese pack." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unfreeze_pack", { p_pack_id: packId });
  if (error) return fromSupabaseError(error, "unfreezePack");
  revalidatePath(`/s/${slug}/panel/alumnos/${studentId}`);
  return { ok: true, message: "Listo, el pack volvió a estar vigente." };
}
