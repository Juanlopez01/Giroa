"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { brandSchema } from "@/lib/validation/studio";
import { fieldErrorsFromZod, type ActionState } from "@/lib/errors";
import { studioUrl } from "@/lib/urls";

/** Ruta válida de una imagen subida por el navegador para este estudio. */
function validPath(studioId: string, kind: "logo" | "cover", path: unknown): path is string {
  return typeof path === "string" && new RegExp(`^${studioId}/${kind}-\\d+\\.(png|jpg|webp)$`).test(path);
}

/**
 * Guarda la marca del estudio: color, logo y portada.
 * "onboarding" termina en el panel; "settings" se queda y avisa.
 */
export async function saveBrand(mode: "onboarding" | "settings", _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) {
    return { ok: false, message: "Tu sesión venció. Entrá de nuevo para seguir." };
  }

  const parsed = brandSchema.safeParse({
    studioId: formData.get("studioId"),
    brandColor: formData.get("brandColor"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const { studioId, brandColor } = parsed.data;

  const supabase = await createClient();
  const changes: { brand_color: string; logo_path?: string; cover_path?: string | null } = { brand_color: brandColor };

  // Las imágenes ya las subió el navegador a Storage (su política solo deja al
  // owner/admin del estudio); acá llega la ruta y se valida que sea de este estudio.
  const logoPath = formData.get("logoPath");
  if (logoPath) {
    if (!validPath(studioId, "logo", logoPath)) return { ok: false, fieldErrors: { logo: "No pudimos usar ese logo. Subilo de nuevo." } };
    changes.logo_path = logoPath;
  }
  const coverPath = formData.get("coverPath");
  if (coverPath) {
    if (!validPath(studioId, "cover", coverPath)) return { ok: false, fieldErrors: { cover: "No pudimos usar esa portada. Subila de nuevo." } };
    changes.cover_path = coverPath;
  } else if (formData.get("removeCover") === "1") {
    changes.cover_path = null;
  }

  // RLS: solo owner/admin actualizan, y solo estas columnas.
  const { data, error } = await supabase.from("studios").update(changes).eq("id", studioId).select("slug").maybeSingle();
  if (error || !data) {
    if (error) console.error("[saveBrand] update", error);
    return { ok: false, message: "No pudimos guardar los cambios. Probá de nuevo." };
  }

  if (mode === "onboarding") redirect(studioUrl(data.slug, "/panel"));
  revalidatePath(`/s/${data.slug}`, "layout");
  return { ok: true, message: "Guardamos tu marca. Así la ven tus alumnos." };
}
