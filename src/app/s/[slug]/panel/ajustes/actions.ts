"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { deleteConnection } from "@/lib/mp/connections";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const settingsSchema = z.object({
  cancelWindowHours: z.coerce
    .number({ error: "Poné un número de horas." })
    .int({ error: "Poné un número entero de horas." })
    .min(0, { error: "No puede ser negativo." })
    .max(168, { error: "Puede ser hasta 168 horas (una semana)." }),
});

export async function updateSettings(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = settingsSchema.safeParse({ cancelWindowHours: formData.get("cancelWindowHours") });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("studios")
    .update({ cancel_window_hours: parsed.data.cancelWindowHours })
    .eq("id", studio.id);
  if (error) return fromSupabaseError(error, "updateSettings");

  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true, message: "Guardamos los cambios." };
}

export async function disconnectMercadoPago(slug: string): Promise<void> {
  const { studio } = await requireAdmin(slug);
  await deleteConnection(studio.id);
  revalidatePath(`/s/${slug}/panel/ajustes`);
}
