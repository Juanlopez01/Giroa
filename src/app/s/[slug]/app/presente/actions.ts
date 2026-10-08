"use server";

import { z } from "zod";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { fromSupabaseError, type ActionState } from "@/lib/errors";
import { checkinPath, isCheckinCode, type CheckinResult } from "@/lib/checkin";

export type CheckinActionState = ActionState & { result?: CheckinResult };

/** Da el presente en una clase puntual (elegida de la lista o reservando en el momento). */
export async function checkInAt(
  slug: string,
  code: string,
  sessionId: string,
  role: "leader" | "follower" | null,
): Promise<CheckinActionState> {
  if (!isCheckinCode(code)) return { ok: false, message: "Este QR no es el del estudio." };
  await requireStudent(slug, checkinPath(code));
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, message: "No encontramos esa clase." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("self_check_in", {
    p_code: code,
    p_session_id: sessionId,
    p_role: role ?? undefined,
  });
  if (error) return fromSupabaseError(error, "checkInAt");

  return { ok: true, result: data as unknown as CheckinResult };
}
