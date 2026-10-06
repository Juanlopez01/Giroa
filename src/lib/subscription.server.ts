import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StudioAccess = {
  state: "trial" | "active" | "grace" | "blocked";
  until: string | null;
  status: string | null;
  plan: string | null;
  subscribed_plan: string | null;
  billing_cycle: "monthly" | "annual" | null;
  amount_cents: number | null;
  discount_pct: number | null;
  has_subscription: boolean;
  current_period_end: string | null;
};

/** Estado de la suscripción del estudio (para staff). Memoizado por request. */
export const getStudioAccess = cache(async (studioId: string): Promise<StudioAccess> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("studio_access", { p_studio_id: studioId });
  return (data as StudioAccess | null) ?? ({ state: "blocked" } as StudioAccess);
});

export function daysUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}
