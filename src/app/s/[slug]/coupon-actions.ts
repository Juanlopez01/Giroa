"use server";

import { getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { fromSupabaseError } from "@/lib/errors";

export type CouponPreview = { ok: true; code: string; discountCents: number; finalCents: number } | { ok: false; message: string };

/** Precio final con un código (para mostrar antes de pagar). La compra lo vuelve a validar. */
export async function previewCoupon(
  slug: string,
  target: "packs" | "events",
  baseCents: number,
  code: string,
): Promise<CouponPreview> {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(clean)) return { ok: false, message: "Ese código no existe o ya no está activo." };
  const studio = await getStudioBySlug(slug);
  if (!studio || !Number.isInteger(baseCents) || baseCents <= 0) return { ok: false, message: "Ese código no existe o ya no está activo." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_coupon", {
    p_studio_id: studio.id,
    p_code: clean,
    p_target: target,
    p_base_cents: baseCents,
  });
  if (error) return { ok: false, message: fromSupabaseError(error, "previewCoupon").message ?? "No pudimos validar el código." };
  const r = data as { discount_cents: number; final_cents: number };
  return { ok: true, code: clean, discountCents: r.discount_cents, finalCents: r.final_cents };
}
