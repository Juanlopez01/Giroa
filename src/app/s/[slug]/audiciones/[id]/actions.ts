"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPreference } from "@/lib/mp/api";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { AUDITION_REF_PREFIX } from "@/lib/formations";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { platformUrl, studioUrl } from "@/lib/urls";

const baseSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Poné tu nombre y apellido." }).max(120),
  phone: z.string().trim().max(40).transform((v) => (v === "" ? null : v)),
  videoUrl: z.string().trim().max(500),
  slotId: z.string().trim(),
});

/** Inscripción a la audición: suma al estudio si hace falta, valida en la base y, si hay arancel, va a MP. */
export async function applyToAudition(slug: string, auditionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(`/audiciones/${auditionId}`)}`);
  const studio = await getStudioBySlug(slug);
  if (!studio || !z.uuid().safeParse(auditionId).success) return { ok: false, message: "No encontramos la audición." };

  const parsed = baseSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    slotId: formData.get("slotId") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const b = parsed.data;

  // Respuestas del formulario: campos "q_<id>". La base valida cuáles existen y cuáles son obligatorias.
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("q_") && typeof value === "string") answers[key.slice(2)] = value;
  }

  const supabase = await createClient();
  if (!(await getMyStudent(studio.id, user.id))) {
    const { error } = await supabase.rpc("join_studio", { p_slug: slug, p_full_name: b.fullName, p_phone: b.phone ?? undefined });
    if (error) return fromSupabaseError(error, "applyToAudition.join");
  }

  const { data: app, error } = await supabase.rpc("apply_to_audition", {
    p_audition_id: auditionId,
    p_answers: answers,
    p_video_url: b.videoUrl || undefined,
    p_slot_id: z.uuid().safeParse(b.slotId).success ? b.slotId : undefined,
  });
  if (error) return fromSupabaseError(error, "applyToAudition");
  revalidatePath(`/s/${slug}`, "layout");

  const myPage = `/app/audiciones/${app.id}`;
  if (app.status !== "pending_payment") redirect(myPage);

  let initPoint: string;
  try {
    const token = await getStudioAccessToken(studio.id);
    if (!token) return { ok: false, message: "El estudio todavía no cobra online. Consultá cómo pagar el arancel." };
    const { data: a } = await supabase.from("auditions").select("title").eq("id", auditionId).single();
    const preference = await createPreference(token, {
      title: `Arancel · ${a?.title ?? "Audición"} · ${studio.name}`,
      unitPriceCents: app.fee_cents,
      externalReference: `${AUDITION_REF_PREFIX}${app.external_reference}`,
      payerEmail: user.email,
      notificationUrl: platformUrl(`/api/webhooks/mercadopago?studio=${studio.id}`),
      backUrl: studioUrl(slug, myPage),
    });
    await createAdminClient().from("audition_applications").update({ mp_preference_id: preference.id }).eq("id", app.id);
    initPoint = preference.init_point;
  } catch (e) {
    console.error("[applyToAudition]", e);
    return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  }
  redirect(initPoint);
}
