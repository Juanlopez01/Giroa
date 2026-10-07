"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const inviteSchema = z.object({
  email: z.email({ error: "Revisá el email." }).trim().toLowerCase(),
  name: z
    .string()
    .trim()
    .max(120, { error: "El nombre es muy largo." })
    .transform((v) => (v === "" ? null : v)),
  role: z.enum(["admin", "teacher"], { error: "Elegí el rol." }),
  canTakePayments: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

const refresh = (slug: string) => revalidatePath(`/s/${slug}/panel`, "layout");

export async function inviteMember(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") ?? "",
    role: formData.get("role"),
    canTakePayments: formData.get("canTakePayments"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const i = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member", {
    p_studio_id: studio.id,
    p_email: i.email,
    p_role: i.role,
    p_display_name: i.name ?? undefined,
    p_can_take_payments: i.canTakePayments,
  });
  if (error) return fromSupabaseError(error, "inviteMember");
  refresh(slug);
  return { ok: true, message: `Listo: le mandamos la invitación a ${i.email}. Vence en 7 días.` };
}

export async function resendInvite(slug: string, email: string, role: "admin" | "teacher", canTakePayments: boolean): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member", {
    p_studio_id: studio.id,
    p_email: email,
    p_role: role,
    p_can_take_payments: canTakePayments,
  });
  if (error) return fromSupabaseError(error, "resendInvite");
  refresh(slug);
  return { ok: true, message: "Reenviada." };
}

export async function cancelInvite(slug: string, inviteId: string): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(inviteId).success) return { ok: false, message: "No encontramos esa invitación." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invite", { p_invite_id: inviteId });
  if (error) return fromSupabaseError(error, "cancelInvite");
  refresh(slug);
  return { ok: true, message: "Invitación cancelada." };
}

export async function updateMember(
  slug: string,
  memberId: string,
  role: "admin" | "teacher",
  canTakePayments: boolean,
): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(memberId).success) return { ok: false, message: "No encontramos a esa persona." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member", {
    p_member_id: memberId,
    p_role: role,
    p_can_take_payments: canTakePayments,
  });
  if (error) return fromSupabaseError(error, "updateMember");
  refresh(slug);
  return { ok: true, message: "Guardado." };
}

export async function removeMember(slug: string, memberId: string): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(memberId).success) return { ok: false, message: "No encontramos a esa persona." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_member_id: memberId });
  if (error) return fromSupabaseError(error, "removeMember");
  refresh(slug);
  return { ok: true, message: "Ya no es parte del equipo." };
}
