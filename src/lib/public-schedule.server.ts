import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PublicSession = {
  id: string;
  title: string;
  description: string | null;
  disciplineName: string;
  level: string | null;
  teacherName: string | null;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  capacity: number;
  spotsLeft: number;
  leaders: number;
  followers: number;
  roleBalance: boolean;
  maxDiff: number | null;
  /** "special" = workshop o seminario. */
  kind: "regular" | "special";
  /** Precio suelto (regular) o del workshop; null si no se vende suelta. */
  priceCents: number | null;
  /** El workshop también se puede reservar con pack. */
  packAllowed: boolean;
};

/** Grilla pública (sin datos personales) vía list_public_sessions. */
export async function listPublicSessions(slug: string, from: Date, to: Date): Promise<PublicSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_sessions", {
    p_slug: slug,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.session_id,
    title: s.title,
    description: s.description,
    disciplineName: s.discipline_name,
    level: s.level,
    teacherName: s.teacher_name,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    cancelled: s.status === "cancelled",
    capacity: s.capacity,
    spotsLeft: s.spots_left,
    leaders: s.leader_count,
    followers: s.follower_count,
    roleBalance: s.role_balance,
    maxDiff: s.role_balance ? s.role_balance_max_diff : null,
    kind: s.kind === "special" ? "special" : "regular",
    priceCents: s.price_cents,
    packAllowed: s.pack_allowed,
  }));
}
