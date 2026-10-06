import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MyBooking = {
  id: string;
  sessionId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  role: "leader" | "follower" | null;
  status: "booked" | "attended" | "cancelled" | "no_show";
  sessionCancelled: boolean;
};

/** Reservas activas del alumno desde `from` (filtradas por su ficha, no solo por RLS). */
export async function myUpcomingBookings(studioId: string, studentId: string, from: Date): Promise<MyBooking[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, status, dance_role, session_id, sessions!inner(starts_at, ends_at, status, offerings(title))")
    .eq("studio_id", studioId)
    .eq("student_id", studentId)
    .in("status", ["booked", "attended"])
    .gte("sessions.ends_at", from.toISOString())
    .order("starts_at", { referencedTable: "sessions" });

  return (data ?? [])
    .map((b) => ({
      id: b.id,
      sessionId: b.session_id,
      title: b.sessions.offerings?.title ?? "Clase",
      startsAt: b.sessions.starts_at,
      endsAt: b.sessions.ends_at,
      role: b.dance_role,
      status: b.status,
      sessionCancelled: b.sessions.status === "cancelled",
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export type MyBalance = { id: string; name: string; remaining: number | null; expiresOn: string | null };

export async function myBalances(studioId: string, studentId: string): Promise<MyBalance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_balances")
    .select("student_pack_id, name, credits_remaining, expires_on")
    .eq("studio_id", studioId)
    .or(`student_id.eq.${studentId},partner_student_id.eq.${studentId}`)
    .eq("is_usable", true)
    .order("expires_at");
  return (data ?? []).flatMap((b) =>
    b.student_pack_id
      ? [{ id: b.student_pack_id, name: b.name ?? "Pack", remaining: b.credits_remaining, expiresOn: b.expires_on }]
      : [],
  );
}

/** "Te quedan 3 clases" / "Clases libres" sumando todos los packs vigentes. */
export function balanceHeadline(balances: MyBalance[]): string {
  if (balances.length === 0) return "No tenés clases disponibles";
  if (balances.some((b) => b.remaining === null)) return "Tenés clases libres";
  const total = balances.reduce((sum, b) => sum + (b.remaining ?? 0), 0);
  return `Te ${total === 1 ? "queda 1 clase" : `quedan ${total} clases`}`;
}

export function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d}/${m}`;
}
