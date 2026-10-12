import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { updatePreapprovalAmount } from "@/lib/mp/subscriptions";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Si cambió el descuento por recomendar de un estudio suscripto, cambia el
 * monto del débito en Mercado Pago y lo guarda. Idempotente: si ya está al día
 * no hace nada, así que se puede llamar en cada aviso de MP (y en reintentos).
 * Primero MP y después la base: si MP falla, el webhook responde 500 y reintenta.
 */
export async function syncReferralPrice(admin: Admin, studioId: string): Promise<void> {
  const { data, error } = await admin.rpc("giroa_reprice", { p_studio_id: studioId });
  if (error) throw error;
  const quote = data as { changed: boolean; preapproval_id?: string; amount_cents?: number; referral_pct?: number } | null;
  if (!quote?.changed || !quote.preapproval_id || quote.amount_cents == null) return;

  await updatePreapprovalAmount(quote.preapproval_id, quote.amount_cents);
  const { error: saveError } = await admin.rpc("giroa_set_subscription_price", {
    p_studio_id: studioId,
    p_preapproval_id: quote.preapproval_id,
    p_amount_cents: quote.amount_cents,
    p_referral_pct: quote.referral_pct ?? 0,
  });
  if (saveError) throw saveError;
}
