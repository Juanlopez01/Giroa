"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { REF_CODE } from "@/lib/referrals";

const joinSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "Contanos tu nombre." })
    .max(120, { error: "El nombre puede tener hasta 120 caracteres." }),
  phone: z
    .string()
    .trim()
    .max(40, { error: "El teléfono es muy largo." })
    .transform((v) => (v === "" ? null : v)),
  role: z.preprocess((v) => (v === "" || v === null ? null : v), z.enum(["leader", "follower"]).nullable()),
});

export async function joinStudio(slug: string, ref: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { ok: false, message: "Tu sesión venció. Entrá de nuevo para seguir." };

  const parsed = joinSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role") ?? null,
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  // join_studio vincula la ficha que el estudio ya tenía con tu email, o crea una.
  const supabase = await createClient();
  const { data: student, error } = await supabase.rpc("join_studio", {
    p_slug: slug,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone ?? undefined,
    p_role: parsed.data.role ?? undefined,
  });
  if (error) return fromSupabaseError(error, "joinStudio");

  // Si vino con link de invitación, queda anotado quién lo invitó (un código
  // inválido no frena el alta).
  if (ref && REF_CODE.test(ref)) {
    const { error: refError } = await supabase.rpc("claim_referral", { p_studio_id: student.studio_id, p_code: ref });
    if (refError) console.error("[joinStudio.claim_referral]", refError);
  }

  redirect("/app?bienvenida=1");
}
