"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { zonedDateTime } from "@/lib/datetime";
import { assessmentSchema, formationSchema, formationSessionSchema, type FormationInput } from "@/lib/validation/formation";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import type { ScanFeedback } from "@/components/panel/qr-scanner";

const refresh = (slug: string) => revalidatePath(`/s/${slug}`, "layout");

function readFormation(formData: FormData) {
  return formationSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    capacity: formData.get("capacity") ?? "",
    requiresApproval: formData.get("requiresApproval"),
    enrollmentFee: formData.get("enrollmentFee") ?? "",
    installmentsCount: formData.get("installmentsCount") || 0,
    installment: formData.get("installment") ?? "",
    firstDueOn: formData.get("firstDueOn") ?? "",
    fullPayment: formData.get("fullPayment") ?? "",
    minAttendance: formData.get("minAttendance") || 80,
  });
}

function toRow(f: FormationInput) {
  return {
    title: f.title,
    description: f.description,
    starts_on: f.startsOn,
    ends_on: f.endsOn,
    capacity: f.capacity,
    requires_approval: f.requiresApproval,
    enrollment_fee_cents: f.enrollmentFee,
    installments_count: f.installmentsCount,
    installment_cents: f.installmentsCount > 0 ? f.installment : 0,
    first_due_on: f.installmentsCount > 0 ? f.firstDueOn : null,
    full_payment_cents: f.fullPayment > 0 ? f.fullPayment : null,
    min_attendance_pct: f.minAttendance,
  };
}

export async function createFormation(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readFormation(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("formations")
    .insert({ ...toRow(parsed.data), studio_id: studio.id, status: "draft" })
    .select("id")
    .single();
  if (error) return fromSupabaseError(error, "createFormation");
  refresh(slug);
  redirect(`/panel/formaciones/${data.id}?nueva=1`);
}

export async function updateFormation(slug: string, formationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readFormation(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.from("formations").update(toRow(parsed.data)).eq("id", formationId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "updateFormation");
  refresh(slug);
  return { ok: true, message: "Guardamos los cambios. Las cuotas de quienes ya están inscriptos no cambian." };
}

export async function setFormationStatus(
  slug: string,
  formationId: string,
  patch: { status?: "draft" | "published" | "archived"; enrollment_open?: boolean },
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("formations").update(patch).eq("id", formationId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "setFormationStatus");
  refresh(slug);
  return {
    ok: true,
    message:
      patch.status === "published"
        ? "¡Publicada! Ya aparece en tu página."
        : patch.status === "archived"
          ? "Archivada: ya no aparece ni recibe postulaciones."
          : patch.enrollment_open === false
            ? "Cerraste las postulaciones."
            : patch.enrollment_open
              ? "Abriste las postulaciones."
              : "Guardado.",
  };
}

export async function addFormationSession(
  slug: string,
  formationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = formationSessionSchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    location: formData.get("location") ?? "",
    onlineUrl: formData.get("onlineUrl") ?? "",
    teacherName: formData.get("teacherName") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const s = parsed.data;
  const startsAt = zonedDateTime(s.date, s.startTime, studio.timezone);
  const endsAt = zonedDateTime(s.date, s.endTime, studio.timezone);
  if (endsAt <= startsAt) return { ok: false, fieldErrors: { endTime: "Tiene que terminar después de empezar." } };

  const supabase = await createClient();
  const { error } = await supabase.from("formation_sessions").insert({
    studio_id: studio.id,
    formation_id: formationId,
    title: s.title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    location: s.location,
    online_url: s.onlineUrl,
    teacher_name: s.teacherName,
  });
  if (error) return fromSupabaseError(error, "addFormationSession");
  refresh(slug);
  return { ok: true, message: "Agregamos el encuentro." };
}

export async function removeFormationSession(slug: string, sessionId: string): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("formation_sessions").delete().eq("id", sessionId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "removeFormationSession");
  refresh(slug);
  return { ok: true, message: "Encuentro borrado." };
}

export async function addAssessment(slug: string, formationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = assessmentSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind"),
    dueOn: formData.get("dueOn") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.from("formation_assessments").insert({
    studio_id: studio.id,
    formation_id: formationId,
    title: parsed.data.title,
    kind: parsed.data.kind,
    due_on: parsed.data.dueOn,
  });
  if (error) return fromSupabaseError(error, "addAssessment");
  refresh(slug);
  return { ok: true, message: "Agregamos la evaluación." };
}

// --------------------------------------------------------------- inscriptos

export async function decideEnrollment(slug: string, enrollmentId: string, approve: boolean): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(enrollmentId).success) return { ok: false, message: "No encontramos esa postulación." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_enrollment", { p_enrollment_id: enrollmentId, p_approve: approve });
  if (error) return fromSupabaseError(error, "decideEnrollment");
  refresh(slug);
  return {
    ok: true,
    message: !approve
      ? "Rechazada. Le avisamos por mail."
      : data.status === "enrolled"
        ? "Aprobada: ya quedó inscripta."
        : "Aprobada: le mandamos el link para pagar la matrícula.",
  };
}

export async function withdrawEnrollment(slug: string, enrollmentId: string): Promise<ActionState> {
  await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_enrollment", { p_enrollment_id: enrollmentId });
  if (error) return fromSupabaseError(error, "withdrawEnrollment");
  refresh(slug);
  return { ok: true, message: "Le dimos de baja. Las cuotas pendientes quedaron sin efecto." };
}

export async function recordFormationPayment(slug: string, chargeId: string, method: "cash" | "transfer"): Promise<ActionState> {
  await requireStaff(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_formation_payment", { p_charge_id: chargeId, p_method: method });
  if (error) return fromSupabaseError(error, "recordFormationPayment");
  refresh(slug);
  return { ok: true, message: "Pago registrado." };
}

export async function markFormationPresent(slug: string, sessionId: string, enrollmentId: string): Promise<ActionState> {
  await requireStaff(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("formation_check_in", { p_session_id: sessionId, p_enrollment_id: enrollmentId });
  if (error) return fromSupabaseError(error, "markFormationPresent");
  refresh(slug);
  return { ok: true, message: "Presente ✓" };
}

export async function scanFormationQr(slug: string, sessionId: string, scanned: string): Promise<ScanFeedback> {
  await requireStaff(slug);
  const token = scanned.startsWith("giroa:") ? scanned.slice(6) : scanned;
  if (!/^[a-f0-9]{32}$/.test(token)) return { kind: "error", text: "Ese QR no es de un alumno de Giroa." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("formation_check_in", { p_session_id: sessionId, p_qr_token: token });
  if (error) return { kind: "error", text: fromSupabaseError(error, "scanFormationQr").message ?? "No pudimos marcarlo." };
  refresh(slug);
  return { kind: "ok", text: `✓ ${(data as { student_name: string }).student_name} presente` };
}

export async function setGrade(
  slug: string,
  assessmentId: string,
  enrollmentId: string,
  value: { grade: number | null; passed: boolean | null },
): Promise<ActionState> {
  await requireStaff(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("formation_set_grade", {
    p_assessment_id: assessmentId,
    p_enrollment_id: enrollmentId,
    // null = no aplica (la función lo acepta; el tipo generado no lo refleja).
    p_grade: value.grade as number,
    p_passed: value.passed as boolean,
  });
  if (error) return fromSupabaseError(error, "setGrade");
  refresh(slug);
  return { ok: true, message: "Guardado" };
}
