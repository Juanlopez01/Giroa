"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fromSupabaseError, type ActionState } from "@/lib/errors";

export async function cancelSession(slug: string, sessionId: string, reason: string): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, message: "No encontramos esa clase." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_session", {
    p_session_id: sessionId,
    p_reason: reason.trim().slice(0, 500) || undefined,
  });
  if (error) return fromSupabaseError(error, "cancelSession");

  revalidatePath(`/s/${slug}/panel`, "layout");
  return {
    ok: true,
    message:
      data && data > 0
        ? `Cancelamos la clase y les devolvimos el crédito a ${data} ${data === 1 ? "alumno" : "alumnos"}.`
        : "Cancelamos la clase.",
  };
}
