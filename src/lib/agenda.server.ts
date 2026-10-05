import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseFeatures } from "@/lib/disciplines";

export type AgendaSession = {
  id: string;
  offeringId: string;
  title: string;
  disciplineName: string;
  roleBalance: boolean;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled";
  capacity: number;
  booked: number;
  leaders: number;
  followers: number;
};

/** Sesiones del estudio en [from, to) con ocupación por rol (vista del staff). */
export async function listAgenda(studioId: string, from: Date, to: Date): Promise<AgendaSession[]> {
  const supabase = await createClient();

  const [{ data: rows, error }, { data: offerings }] = await Promise.all([
    supabase
      .from("session_occupancy")
      .select("*")
      .eq("studio_id", studioId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    supabase
      .from("offerings")
      .select("id, title, disciplines(name, features)")
      .eq("studio_id", studioId),
  ]);
  if (error) throw error;

  const byId = new Map((offerings ?? []).map((o) => [o.id, o]));

  return (rows ?? []).flatMap((r) => {
    const offering = r.offering_id ? byId.get(r.offering_id) : undefined;
    if (!r.session_id || !offering || !r.starts_at || !r.ends_at || !r.status) return [];
    return [
      {
        id: r.session_id,
        offeringId: offering.id,
        title: offering.title,
        disciplineName: offering.disciplines?.name ?? "",
        roleBalance: parseFeatures(offering.disciplines?.features).role_balance,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        status: r.status,
        capacity: r.capacity ?? 0,
        booked: r.booked_count ?? 0,
        leaders: r.leader_count ?? 0,
        followers: r.follower_count ?? 0,
      },
    ];
  });
}
