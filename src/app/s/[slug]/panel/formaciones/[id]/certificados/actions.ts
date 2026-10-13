"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const settingsSchema = z.object({
  signerName: z.string().trim().max(120, "Usá un nombre más corto."),
  signerRole: z.string().trim().max(80, "Usá un cargo más corto."),
  text: z.string().trim().max(300, "Usá un texto más corto (hasta 300 caracteres)."),
});

const path = (slug: string, formationId: string) => `/s/${slug}/panel/formaciones/${formationId}/certificados`;

/** Quién firma y el texto del certificado (los ya emitidos no cambian). */
export async function saveCertificateSettings(slug: string, formationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug, `/panel/formaciones/${formationId}/certificados`);
  if (!z.uuid().safeParse(formationId).success) return { ok: false, message: "No encontramos esa formación." };
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("formations")
    .update({ certificate_signer_name: d.signerName || null, certificate_signer_role: d.signerRole || null, certificate_text: d.text || null })
    .eq("id", formationId)
    .eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "saveCertificateSettings");
  revalidatePath(path(slug, formationId));
  return { ok: true, message: "Guardado. Se usa en los certificados que emitas desde ahora." };
}

export async function issueCertificate(slug: string, formationId: string, enrollmentId: string, force: boolean): Promise<ActionState> {
  await requireAdmin(slug, `/panel/formaciones/${formationId}/certificados`);
  if (!z.uuid().safeParse(enrollmentId).success) return { ok: false, message: "No encontramos esa inscripción." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_certificate", { p_enrollment_id: enrollmentId, p_force: force });
  if (error) return fromSupabaseError(error, "issueCertificate");
  revalidatePath(path(slug, formationId));
  return { ok: true, message: "Certificado emitido: le avisamos por mail." };
}

export async function issueAllCertificates(slug: string, formationId: string): Promise<ActionState> {
  await requireAdmin(slug, `/panel/formaciones/${formationId}/certificados`);
  if (!z.uuid().safeParse(formationId).success) return { ok: false, message: "No encontramos esa formación." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_certificates", { p_formation_id: formationId });
  if (error) return fromSupabaseError(error, "issueAllCertificates");
  revalidatePath(path(slug, formationId));
  const n = data ?? 0;
  return { ok: true, message: n === 0 ? "No había nadie más que cumpla." : n === 1 ? "Emitimos 1 certificado." : `Emitimos ${n} certificados.` };
}

export async function revokeCertificate(slug: string, formationId: string, certificateId: string): Promise<ActionState> {
  await requireAdmin(slug, `/panel/formaciones/${formationId}/certificados`);
  if (!z.uuid().safeParse(certificateId).success) return { ok: false, message: "No encontramos ese certificado." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_certificate", { p_certificate_id: certificateId });
  if (error) return fromSupabaseError(error, "revokeCertificate");
  revalidatePath(path(slug, formationId));
  return { ok: true, message: "Certificado anulado." };
}
