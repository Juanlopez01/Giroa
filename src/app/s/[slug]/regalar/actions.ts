"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPreference } from "@/lib/mp/api";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { GIFT_REF_PREFIX } from "@/lib/gift-cards";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { platformUrl, studioUrl } from "@/lib/urls";

const giftSchema = z.object({
  packProductId: z.uuid({ error: "Elegí qué pack regalar." }),
  buyerName: z.string().trim().min(2, { error: "Poné tu nombre." }).max(120),
  buyerEmail: z.email({ error: "Revisá tu email: ahí te mandamos la tarjeta." }).trim().toLowerCase(),
  recipientName: z
    .string()
    .trim()
    .max(120, { error: "El nombre es muy largo." })
    .transform((v) => (v === "" ? null : v)),
  message: z
    .string()
    .trim()
    .max(500, { error: "El mensaje puede tener hasta 500 caracteres." })
    .transform((v) => (v === "" ? null : v)),
});

/** Compra de una gift card: la RPC crea la tarjeta pendiente con el precio del pack → MP. */
export async function buyGiftCard(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const studio = await getStudioBySlug(slug);
  if (!studio) return { ok: false, message: "No encontramos el estudio." };
  const parsed = giftSchema.safeParse({
    packProductId: formData.get("packProductId"),
    buyerName: formData.get("buyerName"),
    buyerEmail: formData.get("buyerEmail"),
    recipientName: formData.get("recipientName") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const g = parsed.data;

  const supabase = await createClient();
  const { data: card, error } = await supabase.rpc("create_gift_card_order", {
    p_pack_product_id: g.packProductId,
    p_buyer_name: g.buyerName,
    p_buyer_email: g.buyerEmail,
    p_recipient_name: g.recipientName ?? undefined,
    p_message: g.message ?? undefined,
  });
  if (error) return fromSupabaseError(error, "buyGiftCard");

  const admin = createAdminClient();

  let initPoint: string;
  try {
    const token = await getStudioAccessToken(studio.id);
    if (!token) return { ok: false, message: "Este estudio todavía no cobra online. Consultá en el estudio." };
    const preference = await createPreference(token, {
      title: `Regalo: ${card.pack_name} · ${studio.name}`,
      unitPriceCents: card.amount_cents,
      externalReference: `${GIFT_REF_PREFIX}${card.external_reference}`,
      payerEmail: g.buyerEmail,
      notificationUrl: platformUrl(`/api/webhooks/mercadopago?studio=${studio.id}`),
      backUrl: studioUrl(slug, `/regalo/${card.access_token}`),
    });
    await admin.from("gift_cards").update({ mp_preference_id: preference.id }).eq("id", card.id);
    initPoint = preference.init_point;
  } catch (e) {
    console.error("[buyGiftCard]", e);
    await admin.from("gift_cards").update({ status: "cancelled" }).eq("id", card.id).eq("status", "pending");
    return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  }
  redirect(initPoint);
}
