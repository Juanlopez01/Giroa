"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const saleSchema = z.object({
  packProductId: z.uuid({ error: "Elegí el pack." }),
  buyerName: z.string().trim().min(2, { error: "Poné el nombre de quien la compra." }).max(120),
  buyerEmail: z
    .union([z.literal(""), z.email({ error: "Revisá el email." })])
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  recipientName: z.string().trim().max(120).transform((v) => (v === "" ? null : v)),
  message: z.string().trim().max(500, { error: "El mensaje puede tener hasta 500 caracteres." }).transform((v) => (v === "" ? null : v)),
  method: z.enum(["cash", "transfer"], { error: "Elegí efectivo o transferencia." }),
});

const refresh = (slug: string) => revalidatePath(`/s/${slug}/panel`, "layout");

export async function sellGiftCard(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(slug);
  const parsed = saleSchema.safeParse({
    packProductId: formData.get("packProductId"),
    buyerName: formData.get("buyerName"),
    buyerEmail: formData.get("buyerEmail") ?? "",
    recipientName: formData.get("recipientName") ?? "",
    message: formData.get("message") ?? "",
    method: formData.get("method"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const g = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_gift_card_manual", {
    p_pack_product_id: g.packProductId,
    p_buyer_name: g.buyerName,
    p_method: g.method,
    p_recipient_name: g.recipientName ?? undefined,
    p_message: g.message ?? undefined,
    p_buyer_email: g.buyerEmail ?? undefined,
  });
  if (error) return fromSupabaseError(error, "sellGiftCard");
  refresh(slug);
  return { ok: true, message: `Listo. El código es ${data.code}${g.buyerEmail ? " y le mandamos la tarjeta por mail" : ""}.` };
}

export async function redeemForStudent(slug: string, code: string, studentId: string): Promise<ActionState> {
  await requireStaff(slug);
  if (!z.uuid().safeParse(studentId).success) return { ok: false, message: "Elegí un alumno." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_gift_card", { p_code: code, p_student_id: studentId });
  if (error) return fromSupabaseError(error, "redeemForStudent");
  refresh(slug);
  return { ok: true, message: `Canjeada: se acreditó ${(data as { pack_name: string }).pack_name}.` };
}

export async function cancelGiftCard(slug: string, giftCardId: string): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(giftCardId).success) return { ok: false, message: "No encontramos ese regalo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_gift_card", { p_gift_card_id: giftCardId });
  if (error) return fromSupabaseError(error, "cancelGiftCard");
  refresh(slug);
  return { ok: true, message: "Cancelada. Si correspondía, hacé el reintegro." };
}
