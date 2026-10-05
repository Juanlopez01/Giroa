"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { importPayloadSchema, studentSchema } from "@/lib/validation/student";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

function readStudent(formData: FormData) {
  return studentSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    defaultRole: formData.get("defaultRole") ?? null,
  });
}

function studentError(error: { code?: string; message?: string; hint?: string | null }, context: string): ActionState {
  if (error.code === "23505") return { ok: false, fieldErrors: { email: "Ya hay un alumno con ese email en el estudio." } };
  return fromSupabaseError(error, context);
}

export async function createStudent(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  // El staff completo (también profes) puede dar de alta alumnos.
  const { studio } = await requireStaff(slug);
  const parsed = readStudent(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .insert({
      studio_id: studio.id,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      default_role: parsed.data.defaultRole,
    })
    .select("id")
    .single();
  if (error) return studentError(error, "createStudent");

  revalidatePath(`/s/${slug}/panel/alumnos`);
  redirect(`/panel/alumnos/${data.id}?nuevo=1`);
}

export async function updateStudent(
  slug: string,
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { studio } = await requireStaff(slug);
  const parsed = readStudent(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      default_role: parsed.data.defaultRole,
    })
    .eq("id", studentId)
    .eq("studio_id", studio.id);
  if (error) return studentError(error, "updateStudent");

  revalidatePath(`/s/${slug}/panel/alumnos`, "layout");
  return { ok: true, message: "Guardamos los cambios." };
}

export async function setStudentActive(slug: string, studentId: string, active: boolean): Promise<void> {
  const { studio } = await requireStaff(slug);
  const supabase = await createClient();
  await supabase.from("students").update({ is_active: active }).eq("id", studentId).eq("studio_id", studio.id);
  revalidatePath(`/s/${slug}/panel/alumnos`, "layout");
}

export type ImportResult = {
  ok: boolean;
  message?: string;
  created?: number;
  updated?: number;
  packs?: number;
  errors?: { row: number; message: string }[];
};

export async function importStudents(slug: string, rowsJson: string): Promise<ImportResult> {
  const { studio } = await requireAdmin(slug);

  let rows: unknown;
  try {
    rows = JSON.parse(rowsJson);
  } catch {
    return { ok: false, message: "No pudimos leer el archivo. Probá de nuevo." };
  }
  const parsed = importPayloadSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, message: "Hay filas con datos inválidos. Revisá el archivo y probá de nuevo." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_students", {
    p_studio_id: studio.id,
    p_rows: parsed.data,
  });
  if (error) {
    const state = fromSupabaseError(error, "importStudents");
    return { ok: false, message: state.message };
  }

  const result = data as { created: number; updated: number; packs: number; errors: { row: number; message: string }[] };
  // La RPC numera las filas que le mandamos; las pasamos al número de fila del archivo.
  const errors = result.errors.map((e) => ({ row: parsed.data[e.row - 1]?.row ?? e.row, message: e.message }));

  revalidatePath(`/s/${slug}/panel`, "layout");
  return { ok: true, created: result.created, updated: result.updated, packs: result.packs, errors };
}
