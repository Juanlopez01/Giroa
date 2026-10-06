"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fromSupabaseError } from "@/lib/errors";

export type CheckInResult =
  | { ok: true; studentName: string; walkIn: boolean; creditsRemaining: number | null; expiresOn: string | null }
  | { ok: false; message: string };

/** Escaneo del QR del alumno ("giroa:<token>"). */
export async function checkInByQr(slug: string, sessionId: string, scanned: string): Promise<CheckInResult> {
  await requireStaff(slug);
  const token = scanned.startsWith("giroa:") ? scanned.slice(6) : scanned;
  if (!z.uuid().safeParse(sessionId).success || !/^[a-f0-9]{32}$/.test(token)) {
    return { ok: false, message: "Ese QR no es de Giroa." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_by_qr", { p_session_id: sessionId, p_qr_token: token });
  if (error) return { ok: false, message: fromSupabaseError(error, "checkInByQr").message ?? "No pudimos marcarlo." };

  const r = data as {
    student_name: string;
    walk_in: boolean;
    credits_remaining: number | null;
    expires_on: string | null;
  };
  revalidatePath(`/s/${slug}/panel/agenda/${sessionId}`);
  return {
    ok: true,
    studentName: r.student_name,
    walkIn: r.walk_in,
    creditsRemaining: r.credits_remaining,
    expiresOn: r.expires_on,
  };
}

/** Marcar presente a mano (con o sin reserva). */
export async function checkInStudent(slug: string, sessionId: string, studentId: string): Promise<CheckInResult> {
  await requireStaff(slug);
  if (!z.uuid().safeParse(sessionId).success || !z.uuid().safeParse(studentId).success) {
    return { ok: false, message: "No encontramos al alumno." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_in", { p_session_id: sessionId, p_student_id: studentId });
  if (error) return { ok: false, message: fromSupabaseError(error, "checkInStudent").message ?? "No pudimos marcarlo." };

  revalidatePath(`/s/${slug}/panel/agenda/${sessionId}`);
  return { ok: true, studentName: "", walkIn: false, creditsRemaining: null, expiresOn: null };
}
