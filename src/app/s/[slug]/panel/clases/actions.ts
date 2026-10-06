"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { parseFeatures } from "@/lib/disciplines";
import { can } from "@/lib/gating";
import { offeringSchema, scheduleSchema, type OfferingInput } from "@/lib/validation/offering";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

// El estudio sale del slug (subdominio) y la autorización la valida el
// servidor: nunca se confía en un studio_id que mande el cliente.

function readOffering(formData: FormData) {
  return offeringSchema.safeParse({
    title: formData.get("title"),
    disciplineKey: formData.get("disciplineKey"),
    level: formData.get("level"),
    teacherName: formData.get("teacherName"),
    description: formData.get("description"),
    capacity: formData.get("capacity"),
    roleBalance: formData.get("roleBalance"),
    roleBalanceMaxDiff: formData.get("roleBalanceMaxDiff") || undefined,
  });
}

/** Columnas de offerings a partir del input, respetando los flags de la disciplina. */
async function toRow(studioId: string, input: OfferingInput) {
  const supabase = await createClient();
  const { data: discipline } = await supabase
    .from("disciplines")
    .select("features")
    .eq("key", input.disciplineKey)
    .eq("is_active", true)
    .maybeSingle();
  if (!discipline) return null;

  const features = parseFeatures(discipline.features);
  const roleBalance = features.role_balance && (await can(studioId, "role_balance"));
  return {
    title: input.title,
    discipline_key: input.disciplineKey,
    level: input.level ?? null,
    teacher_name: input.teacherName ?? null,
    description: input.description ?? null,
    capacity: input.capacity,
    role_balance_max_diff: roleBalance && input.roleBalance ? (input.roleBalanceMaxDiff ?? null) : null,
  };
}

export async function createOffering(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readOffering(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const row = await toRow(studio.id, parsed.data);
  if (!row) return { ok: false, fieldErrors: { disciplineKey: "Elegí una disciplina." } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offerings")
    .insert({ ...row, studio_id: studio.id, kind: "regular" })
    .select("id")
    .single();
  if (error) return fromSupabaseError(error, "createOffering");

  redirect(`/panel/clases/${data.id}?nueva=1`);
}

export async function updateOffering(
  slug: string,
  offeringId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readOffering(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const row = await toRow(studio.id, parsed.data);
  if (!row) return { ok: false, fieldErrors: { disciplineKey: "Elegí una disciplina." } };

  const supabase = await createClient();
  const { error } = await supabase.from("offerings").update(row).eq("id", offeringId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "updateOffering");

  revalidatePath(`/s/${slug}/panel/clases`, "layout");
  return { ok: true, message: "Guardamos los cambios." };
}

export async function setOfferingActive(slug: string, offeringId: string, active: boolean): Promise<void> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  await supabase.from("offerings").update({ is_active: active }).eq("id", offeringId).eq("studio_id", studio.id);
  revalidatePath(`/s/${slug}/panel/clases`, "layout");
}

export async function addSchedule(
  slug: string,
  offeringId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = scheduleSchema.safeParse({
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMinutes: formData.get("durationMinutes"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("class_schedules").insert({
    studio_id: studio.id,
    offering_id: offeringId,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    duration_minutes: parsed.data.durationMinutes,
  });
  if (error) return fromSupabaseError(error, "addSchedule");

  // Arma la grilla de las próximas 4 semanas (sin duplicar).
  const { data: created, error: genError } = await supabase.rpc("generate_sessions", {
    p_studio_id: studio.id,
    p_weeks: 4,
  });
  if (genError) return fromSupabaseError(genError, "addSchedule.generate");

  revalidatePath(`/s/${slug}/panel`, "layout");
  return {
    ok: true,
    message:
      created && created > 0
        ? `Listo: agregamos el horario y armamos ${created} ${created === 1 ? "clase" : "clases"} de las próximas 4 semanas.`
        : "Listo: agregamos el horario.",
  };
}

export async function removeSchedule(slug: string, scheduleId: string): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(scheduleId).success) return { ok: false, message: "No encontramos ese horario." };

  const supabase = await createClient();
  const { data: kept, error } = await supabase.rpc("remove_schedule", { p_schedule_id: scheduleId });
  if (error) return fromSupabaseError(error, "removeSchedule");

  revalidatePath(`/s/${slug}/panel`, "layout");
  return {
    ok: true,
    message:
      kept && kept > 0
        ? `Quitamos el horario. ${kept === 1 ? "Queda 1 clase" : `Quedan ${kept} clases`} con alumnos anotados: si no se dan, cancelalas desde la agenda.`
        : "Quitamos el horario y sus próximas clases.",
  };
}

export async function generateSessions(slug: string): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_sessions", { p_studio_id: studio.id, p_weeks: 4 });
  if (error) return fromSupabaseError(error, "generateSessions");
  revalidatePath(`/s/${slug}/panel`, "layout");
  return {
    ok: true,
    message: data && data > 0 ? `Armamos ${data} clases nuevas.` : "La grilla de las próximas 4 semanas ya estaba completa.",
  };
}
