import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseFeatures } from "@/lib/disciplines";

export type AgendaSession = {
  id: string;
  offeringId: string;
  title: string;
  disciplineName: string;
  roleBalance: boolean;
  /** Profe del equipo asignado a la clase (studio_members.id), si hay. */
  teacherMemberId: string | null;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled";
  capacity: number;
  booked: number;
  /** Ya dieron el presente (con el QR del estudio o el profe). */
  attended: number;
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
      .select("id, title, teacher_member_id, disciplines(name, features)")
      .eq("studio_id", studioId),
  ]);
  if (error) throw error;

  const byId = new Map((offerings ?? []).map((o) => [o.id, o]));

  const ids = (rows ?? []).flatMap((r) => (r.session_id ? [r.session_id] : []));
  const { data: present } = ids.length
    ? await supabase.from("bookings").select("session_id").in("session_id", ids).eq("status", "attended")
    : { data: [] };
  const attendedBy = new Map<string, number>();
  for (const b of present ?? []) attendedBy.set(b.session_id, (attendedBy.get(b.session_id) ?? 0) + 1);

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
        teacherMemberId: offering.teacher_member_id,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        status: r.status,
        capacity: r.capacity ?? 0,
        booked: r.booked_count ?? 0,
        attended: attendedBy.get(r.session_id) ?? 0,
        leaders: r.leader_count ?? 0,
        followers: r.follower_count ?? 0,
      },
    ];
  });
}
