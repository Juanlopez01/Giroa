import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Oferta fundadores: los primeros 10 de cada plan pagan el 50% de por vida.
// Se aplica sola al suscribirse mientras queden lugares (giroa_quote).

export type FounderSpot = { discountPct: number; spotsLeft: number };

/** Lugares de fundador que quedan, por plan. Solo planes con oferta. */
export const getFounderSpots = cache(async (): Promise<Record<string, FounderSpot>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("giroa_founder_spots");
  return Object.fromEntries((data ?? []).map((r) => [r.plan, { discountPct: r.discount_pct, spotsLeft: r.spots_left }]));
});
