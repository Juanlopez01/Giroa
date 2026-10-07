"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseError, type ActionState } from "@/lib/errors";
import { createPreference } from "@/lib/mp/api";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { platformUrl, studioUrl } from "@/lib/urls";

/**
 * Compra de un pack con Checkout Pro:
 *  1. create_pack_payment (RPC, como el alumno) crea el pago pendiente con el
 *     precio del producto (el cliente nunca manda el monto),
 *  2. se arma la preferencia con el token del estudio,
 *  3. se redirige a Mercado Pago. El webhook acredita el pack.
 */
export async function buyPack(slug: string, packProductId: string, coupon: string | null = null): Promise<ActionState> {
  const { studio, user } = await requireStudent(slug, "/app/packs");
  if (!z.uuid().safeParse(packProductId).success) return { ok: false, message: "Este pack ya no está disponible." };

  const supabase = await createClient();
  const { data: payment, error } = await supabase.rpc("create_pack_payment", {
    p_pack_product_id: packProductId,
    p_coupon: coupon?.trim() || undefined,
  });
  if (error) return fromSupabaseError(error, "buyPack");

  const { data: product } = await supabase.from("pack_products").select("name").eq("id", packProductId).single();

  let initPoint: string;
  try {
    const token = await getStudioAccessToken(studio.id);
    if (!token) return { ok: false, message: "Este estudio todavía no cobra online. Consultá en el estudio cómo pagar." };

    const preference = await createPreference(token, {
      title: `${product?.name ?? "Pack"} · ${studio.name}`,
      unitPriceCents: payment.amount_cents,
      externalReference: payment.external_reference,
      payerEmail: user.email,
      notificationUrl: platformUrl(`/api/webhooks/mercadopago?studio=${studio.id}`),
      backUrl: studioUrl(slug, "/app/pago"),
    });
    await createAdminClient().from("payments").update({ mp_preference_id: preference.id }).eq("id", payment.id);
    initPoint = preference.init_point;
  } catch (e) {
    console.error("[buyPack]", e);
    return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  }

  redirect(initPoint);
}

/** Canje de una gift card: la base valida el código, el estudio y que no esté usada. */
export async function redeemGiftCard(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStudent(slug, "/app/packs");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (code.replace(/^REGALO-/, "").replace(/-/g, "").length !== 8) {
    return { ok: false, fieldErrors: { code: "El código tiene la forma REGALO-XXXX-XXXX." } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_gift_card", { p_code: code });
  if (error) return fromSupabaseError(error, "redeemGiftCard");
  revalidatePath(`/s/${slug}/app`, "layout");
  return { ok: true, message: `¡Listo! Te acreditamos ${(data as { pack_name: string }).pack_name}. Ya podés reservar.` };
}
