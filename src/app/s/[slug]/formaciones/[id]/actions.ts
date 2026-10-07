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
import { CHARGE_KIND_LABEL, FORMATION_REF_PREFIX } from "@/lib/formations";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { platformUrl, studioUrl } from "@/lib/urls";

const applySchema = z.object({
  fullName: z.string().trim().min(2, { error: "Poné tu nombre y apellido." }).max(120),
  phone: z.string().trim().max(40).transform((v) => (v === "" ? null : v)),
  message: z.string().trim().max(2000, { error: "El mensaje es muy largo." }).transform((v) => (v === "" ? null : v)),
});

/** Postularse: si todavía no es alumno del estudio, primero lo suma (join_studio). */
export async function applyToFormation(slug: string, formationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(`/formaciones/${formationId}`)}`);
  const studio = await getStudioBySlug(slug);
  if (!studio) return { ok: false, message: "No encontramos el estudio." };
  const parsed = applySchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  if (!(await getMyStudent(studio.id, user.id))) {
    const { error } = await supabase.rpc("join_studio", {
      p_slug: slug,
      p_full_name: parsed.data.fullName,
      p_phone: parsed.data.phone ?? undefined,
    });
    if (error) return fromSupabaseError(error, "applyToFormation.join");
  }

  const { data, error } = await supabase.rpc("apply_to_formation", {
    p_formation_id: formationId,
    p_message: parsed.data.message ?? undefined,
  });
  if (error) return fromSupabaseError(error, "applyToFormation");
  revalidatePath(`/s/${slug}`, "layout");
  redirect(`/app/formaciones/${data.id}`);
}

/** Pagar una matrícula, cuota o el total con Mercado Pago (cuenta del estudio). */
export async function payFormationCharge(slug: string, chargeId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Tu sesión venció. Entrá de nuevo." };
  const studio = await getStudioBySlug(slug);
  if (!studio || !z.uuid().safeParse(chargeId).success) return { ok: false, message: "No encontramos ese cobro." };

  // RLS: solo ve sus propios cobros.
  const supabase = await createClient();
  const { data: charge } = await supabase
    .from("formation_charges")
    .select("id, enrollment_id, kind, number, amount_cents, status, external_reference, formations(title)")
    .eq("id", chargeId)
    .maybeSingle();
  if (!charge || charge.status !== "pending") return { ok: false, message: "Este cobro ya no está pendiente." };

  let initPoint: string;
  try {
    const token = await getStudioAccessToken(studio.id);
    if (!token) return { ok: false, message: "El estudio todavía no cobra online. Consultá cómo pagar." };
    const label = charge.kind === "installment" ? `Cuota ${charge.number}` : CHARGE_KIND_LABEL[charge.kind];
    const preference = await createPreference(token, {
      title: `${label} · ${charge.formations?.title ?? "Formación"} · ${studio.name}`,
      unitPriceCents: charge.amount_cents,
      externalReference: `${FORMATION_REF_PREFIX}${charge.external_reference}`,
      payerEmail: user.email,
      notificationUrl: platformUrl(`/api/webhooks/mercadopago?studio=${studio.id}`),
      backUrl: studioUrl(slug, `/app/formaciones/${charge.enrollment_id}`),
    });
    await createAdminClient().from("formation_charges").update({ mp_preference_id: preference.id }).eq("id", charge.id);
    initPoint = preference.init_point;
  } catch (e) {
    console.error("[payFormationCharge]", e);
    return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  }
  redirect(initPoint);
}

/** Elegir pagar el total con descuento: crea el cobro y va a pagarlo. */
export async function payFullFormation(slug: string, enrollmentId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("choose_full_payment", { p_enrollment_id: enrollmentId });
  if (error) return fromSupabaseError(error, "payFullFormation");
  return payFormationCharge(slug, data.id);
}
