"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { isMaterialPath, MATERIAL_MAX_BYTES, MATERIAL_MIME_TYPES, MATERIALS_BUCKET } from "@/lib/materials";

const base = z.object({
  title: z.string().trim().min(2, "Poné un título (por ejemplo, “Apunte 1”).").max(120, "Usá un título más corto."),
  description: z.string().trim().max(1000, "Usá una descripción más corta.").optional(),
  sessionId: z.union([z.uuid(), z.literal("")]).optional(),
});
const linkSchema = base.extend({
  kind: z.literal("link"),
  url: z.url("Pegá un link completo (que empiece con https://).").refine((u) => u.startsWith("https://"), "El link tiene que empezar con https://"),
});
const fileSchema = base.extend({
  kind: z.literal("file"),
  storagePath: z.string().min(1, "Elegí un archivo."),
  mimeType: z.enum(MATERIAL_MIME_TYPES, "Ese tipo de archivo no se puede subir: usá PDF, imagen o audio."),
  sizeBytes: z.coerce.number().int().min(1).max(MATERIAL_MAX_BYTES, "El archivo pesa más de 50 MB."),
});

/** El archivo ya lo subió el navegador a Storage; acá se valida la ruta y se guarda. */
export async function addMaterial(slug: string, formationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireStaff(slug, `/panel/formaciones/${formationId}/material`);
  if (!z.uuid().safeParse(formationId).success) return { ok: false, message: "No encontramos esa formación." };

  const raw = Object.fromEntries(formData);
  const parsed = raw.kind === "link" ? linkSchema.safeParse(raw) : fileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const d = parsed.data;

  const supabase = await createClient();
  if (d.kind === "file" && !isMaterialPath(studio.id, formationId, d.storagePath)) {
    return { ok: false, fieldErrors: { file: "No pudimos usar ese archivo. Subilo de nuevo." } };
  }

  const { error } = await supabase.from("formation_materials").insert({
    studio_id: studio.id,
    formation_id: formationId,
    session_id: d.sessionId || null,
    title: d.title,
    description: d.description || null,
    kind: d.kind,
    url: d.kind === "link" ? d.url : null,
    storage_path: d.kind === "file" ? d.storagePath : null,
    mime_type: d.kind === "file" ? d.mimeType : null,
    size_bytes: d.kind === "file" ? d.sizeBytes : null,
    created_by: user.id,
  });
  if (error) {
    // No queda un archivo huérfano en el bucket.
    if (d.kind === "file") await supabase.storage.from(MATERIALS_BUCKET).remove([d.storagePath]);
    return fromSupabaseError(error, "addMaterial");
  }

  revalidatePath(`/s/${slug}/panel/formaciones/${formationId}`, "layout");
  return { ok: true, message: d.kind === "file" ? "¡Listo! Subiste el archivo." : "¡Listo! Agregaste el link." };
}

export async function deleteMaterial(slug: string, formationId: string, materialId: string): Promise<ActionState> {
  await requireStaff(slug, `/panel/formaciones/${formationId}/material`);
  if (!z.uuid().safeParse(materialId).success) return { ok: false, message: "No encontramos ese material." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("formation_materials").delete().eq("id", materialId).select("storage_path").maybeSingle();
  if (error) return fromSupabaseError(error, "deleteMaterial");
  if (data?.storage_path) await supabase.storage.from(MATERIALS_BUCKET).remove([data.storage_path]);

  revalidatePath(`/s/${slug}/panel/formaciones/${formationId}`, "layout");
  return { ok: true, message: "Material borrado." };
}
