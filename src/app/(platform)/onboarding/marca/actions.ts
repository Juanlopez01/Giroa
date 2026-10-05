"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { brandSchema, LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/validation/studio";
import { fieldErrorsFromZod, type ActionState } from "@/lib/errors";
import { studioUrl } from "@/lib/urls";

const EXTENSIONS: Record<(typeof LOGO_TYPES)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function saveBrand(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
  let logoPath: string | undefined;

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!(LOGO_TYPES as readonly string[]).includes(logo.type)) {
      return { ok: false, fieldErrors: { logo: "El logo tiene que ser PNG, JPG o WEBP." } };
    }
    if (logo.size > LOGO_MAX_BYTES) {
      return { ok: false, fieldErrors: { logo: "El logo puede pesar hasta 2 MB." } };
    }
    // La política de Storage solo deja subir al owner/admin de ese estudio.
    logoPath = `${studioId}/logo-${Date.now()}.${EXTENSIONS[logo.type as keyof typeof EXTENSIONS]}`;
    const { error } = await supabase.storage
      .from("studio-assets")
      .upload(logoPath, logo, { contentType: logo.type, upsert: false });
    if (error) {
      console.error("[saveBrand] upload", error);
      return { ok: false, fieldErrors: { logo: "No pudimos subir el logo. Probá con otra imagen." } };
    }
  }

  // RLS: solo owner/admin actualizan, y solo estas columnas.
  const { data, error } = await supabase
    .from("studios")
    .update({ brand_color: brandColor, ...(logoPath ? { logo_path: logoPath } : {}) })
    .eq("id", studioId)
    .select("slug")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[saveBrand] update", error);
    return { ok: false, message: "No pudimos guardar los cambios. Probá de nuevo." };
  }

  redirect(studioUrl(data.slug, "/panel"));
}
