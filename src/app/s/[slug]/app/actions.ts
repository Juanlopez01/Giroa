"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

// El alumno nunca escribe en tablas: todo por RPC (book_session, cancel_booking,
// update_my_student_profile), que validan cupo, roles, saldo y permisos.

export async function bookSession(slug: string, sessionId: string, role: "leader" | "follower" | null): Promise<ActionState> {
  await requireStudent(slug, "/app/clases");
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, message: "No encontramos esa clase." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("book_session", { p_session_id: sessionId, p_role: role ?? undefined });
  if (error) return fromSupabaseError(error, "bookSession");

  revalidatePath(`/s/${slug}/app`, "layout");
  revalidatePath(`/s/${slug}`);
  return { ok: true, message: "¡Listo! Tenés tu lugar." };
}

export async function cancelBooking(slug: string, bookingId: string): Promise<ActionState> {
  await requireStudent(slug, "/app");
  if (!z.uuid().safeParse(bookingId).success) return { ok: false, message: "No encontramos esa reserva." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  if (error) return fromSupabaseError(error, "cancelBooking");

  revalidatePath(`/s/${slug}/app`, "layout");
  revalidatePath(`/s/${slug}`);
  return {
    ok: true,
    message: data.credit_refunded
      ? "Cancelaste la reserva y te devolvimos la clase."
      : "Cancelaste la reserva. Como fue con poca anticipación, la clase no se devuelve.",
  };
}

const profileSchema = z.object({
  fullName: z.string().trim().min(1, { error: "El nombre no puede quedar vacío." }).max(120),
  phone: z
    .string()
    .trim()
    .max(40, { error: "El teléfono es muy largo." })
    .transform((v) => (v === "" ? null : v)),
  role: z.preprocess((v) => (v === "" || v === null ? null : v), z.enum(["leader", "follower"]).nullable()),
});

export async function updateProfile(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { student } = await requireStudent(slug, "/app/perfil");
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role") ?? null,
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_student_profile", {
    p_student_id: student.id,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone ?? undefined,
    p_default_role: parsed.data.role ?? undefined,
  });
  if (error) return fromSupabaseError(error, "updateProfile");

  revalidatePath(`/s/${slug}/app`, "layout");
  return { ok: true, message: "Guardamos tus datos." };
}

export async function joinWaitlist(slug: string, sessionId: string, role: "leader" | "follower" | null): Promise<ActionState> {
  await requireStudent(slug, "/app/clases");
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, message: "No encontramos esa clase." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_waitlist", { p_session_id: sessionId, p_role: role ?? undefined });
  if (error) return fromSupabaseError(error, "joinWaitlist");

  revalidatePath(`/s/${slug}/app`, "layout");
  return { ok: true, message: "Te anotamos. Si se libera un lugar, te avisamos por mail." };
}

export async function leaveWaitlist(slug: string, sessionId: string): Promise<ActionState> {
  await requireStudent(slug, "/app/clases");
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, message: "No encontramos esa clase." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_waitlist", { p_session_id: sessionId });
  if (error) return fromSupabaseError(error, "leaveWaitlist");

  revalidatePath(`/s/${slug}/app`, "layout");
  return { ok: true, message: "Saliste de la lista de espera." };
}

/** Clase de prueba gratis: book_session con p_trial (la base valida que corresponda). */
export async function bookTrialClass(slug: string, sessionId: string, role: "leader" | "follower" | null): Promise<ActionState> {
  await requireStudent(slug, "/app/clases");
  if (!z.uuid().safeParse(sessionId).success) return { ok: false, message: "No encontramos esa clase." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("book_session", { p_session_id: sessionId, p_role: role ?? undefined, p_trial: true });
  if (error) return fromSupabaseError(error, "bookTrialClass");

  revalidatePath(`/s/${slug}/app`, "layout");
  revalidatePath(`/s/${slug}`);
  return { ok: true, message: "¡Listo! Te esperamos en tu clase de prueba." };
}
