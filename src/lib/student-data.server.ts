import "server-only";
import { createClient } from "@/lib/supabase/server";
import { startOfDay, toYmd } from "@/lib/datetime";

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

export type MyBalance = { id: string; name: string; remaining: number | null; total: number | null; expiresOn: string | null };

export async function myBalances(studioId: string, studentId: string): Promise<MyBalance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_balances")
    .select("student_pack_id, name, credits_remaining, credits_total, expires_on")
    .eq("studio_id", studioId)
    .or(`student_id.eq.${studentId},partner_student_id.eq.${studentId}`)
    .eq("is_usable", true)
    .order("expires_at");
  return (data ?? []).flatMap((b) =>
    b.student_pack_id
      ? [{ id: b.student_pack_id, name: b.name ?? "Pack", remaining: b.credits_remaining, total: b.credits_total, expiresOn: b.expires_on }]
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

export type MyAttendance = { thisMonth: number; lastMonth: number; days: number[] };

/** Clases a las que vino este mes y el anterior (hora local del estudio). `days`: día del mes de cada una. */
export async function myAttendance(studioId: string, studentId: string, timeZone: string, now: Date): Promise<MyAttendance> {
  const ym = (d: Date) => toYmd(d, timeZone).slice(0, 7);
  const thisYm = ym(now);
  const [y, m] = thisYm.split("-").map(Number) as [number, number];
  const lastYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("sessions!inner(starts_at)")
    .eq("studio_id", studioId)
    .eq("student_id", studentId)
    .eq("status", "attended")
    .gte("sessions.starts_at", startOfDay(`${lastYm}-01`, timeZone).toISOString());

  const out: MyAttendance = { thisMonth: 0, lastMonth: 0, days: [] };
  for (const b of data ?? []) {
    const ymd = toYmd(new Date(b.sessions.starts_at), timeZone);
    if (ymd.startsWith(thisYm)) {
      out.thisMonth += 1;
      out.days.push(Number(ymd.slice(8, 10)));
    } else if (ymd.startsWith(lastYm)) {
      out.lastMonth += 1;
    }
  }
  return out;
}
