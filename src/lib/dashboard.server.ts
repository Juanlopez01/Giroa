import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysYmd, startOfDay, todayYmd, toYmd, weekdayOf, formatTime } from "@/lib/datetime";

// Números del panel del dueño. Todo pasa por RLS (owner/admin ven su estudio).

function monthStart(ym: string, tz: string) {
  return startOfDay(`${ym}-01`, tz);
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type IncomeSummary = {
  thisMonth: number;
  lastMonthSameDay: number;
  count: number;
  byMethod: Record<"cash" | "transfer" | "mercadopago", number>;
};

/** Cobrado en el mes, y lo cobrado el mes pasado hasta el mismo día (comparación justa). */
export async function incomeSummary(studioId: string, tz: string, now: Date): Promise<IncomeSummary> {
  const supabase = await createClient();
  const today = todayYmd(tz, now);
  const ym = today.slice(0, 7);
  const prev = shiftMonth(ym, -1);
  const day = Number(today.slice(8, 10));
  // Mismo día del mes pasado (o el último día si el mes es más corto).
  const prevDays = new Date(Date.UTC(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)), 0)).getUTCDate();
  const prevCut = startOfDay(addDaysYmd(`${prev}-${String(Math.min(day, prevDays)).padStart(2, "0")}`, 1), tz);

  const from = monthStart(prev, tz).toISOString();
  const to = monthStart(shiftMonth(ym, 1), tz).toISOString();
  // Packs + entradas de eventos (las gratis no suman) + gift cards.
  const [{ data: packs }, { data: tickets }, { data: gifts }, { data: formation }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount_cents, method, paid_at")
      .eq("studio_id", studioId)
      .eq("status", "approved")
      .gte("paid_at", from)
      .lt("paid_at", to),
    supabase
      .from("event_orders")
      .select("amount_cents, method, paid_at")
      .eq("studio_id", studioId)
      .eq("status", "paid")
      .gt("amount_cents", 0)
      .gte("paid_at", from)
      .lt("paid_at", to),
    // Gift cards: el ingreso es el día de la venta (aunque se canjee después).
    supabase
      .from("gift_cards")
      .select("amount_cents, method, paid_at")
      .eq("studio_id", studioId)
      .in("status", ["active", "redeemed", "expired"])
      .gte("paid_at", from)
      .lt("paid_at", to),
    // Matrículas y cuotas de formaciones.
    supabase
      .from("formation_charges")
      .select("amount_cents, method, paid_at")
      .eq("studio_id", studioId)
      .eq("status", "paid")
      .gte("paid_at", from)
      .lt("paid_at", to),
  ]);
  const data = [...(packs ?? []), ...[...(tickets ?? []), ...(gifts ?? []), ...(formation ?? [])].filter((t) => t.method !== null)] as {
    amount_cents: number;
    method: "cash" | "transfer" | "mercadopago";
    paid_at: string | null;
  }[];

  const thisStart = monthStart(ym, tz).getTime();
  const summary: IncomeSummary = { thisMonth: 0, lastMonthSameDay: 0, count: 0, byMethod: { cash: 0, transfer: 0, mercadopago: 0 } };
  for (const p of data) {
    const t = new Date(p.paid_at ?? 0).getTime();
    if (t >= thisStart) {
      summary.thisMonth += p.amount_cents;
      summary.count += 1;
      summary.byMethod[p.method] += p.amount_cents;
    } else if (t < prevCut.getTime()) {
      summary.lastMonthSameDay += p.amount_cents;
    }
  }
  return summary;
}

export type FollowUp = {
  studentId: string;
  name: string;
  phone: string | null;
  detail: string;
};

/** Packs vigentes que vencen en los próximos `days` días. */
export async function expiringSoon(studioId: string, tz: string, now: Date, days = 7): Promise<FollowUp[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_balances")
    .select("student_id, credits_remaining, expires_on, expires_at")
    .eq("studio_id", studioId)
    .eq("is_usable", true)
    .lte("expires_at", new Date(now.getTime() + days * 86_400_000).toISOString())
    .order("expires_at");
  const rows = (data ?? []).filter((r) => r.student_id);
  if (!rows.length) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, phone")
    .in("id", rows.map((r) => r.student_id as string));
  const byId = new Map((students ?? []).map((s) => [s.id, s]));

  return rows.flatMap((r) => {
    const s = byId.get(r.student_id as string);
    if (!s || !r.expires_on) return [];
    const [, m, d] = r.expires_on.split("-").map(Number);
    const left = r.credits_remaining === null ? "clases libres" : `${r.credits_remaining} ${r.credits_remaining === 1 ? "clase" : "clases"}`;
    return [{ studentId: s.id, name: s.full_name, phone: s.phone, detail: `Le quedan ${left}, vence el ${d}/${m}` }];
  });
}

/** Alumnos que vinieron en los últimos 60 días pero hoy no tienen saldo. */
export async function activeWithoutBalance(studioId: string, now: Date): Promise<FollowUp[]> {
  const supabase = await createClient();
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();

  const [{ data: attended }, { data: usable }] = await Promise.all([
    supabase
      .from("bookings")
      .select("student_id, checked_in_at")
      .eq("studio_id", studioId)
      .eq("status", "attended")
      .eq("is_trial", false) // los de clase de prueba van en trialNotConverted
      .gte("checked_in_at", since)
      .order("checked_in_at", { ascending: false }),
    supabase.from("student_balances").select("student_id, partner_student_id").eq("studio_id", studioId).eq("is_usable", true),
  ]);

  const withBalance = new Set((usable ?? []).flatMap((b) => [b.student_id, b.partner_student_id]).filter(Boolean));
  const lastVisit = new Map<string, string>();
  for (const b of attended ?? []) {
    if (!withBalance.has(b.student_id) && !lastVisit.has(b.student_id) && b.checked_in_at) lastVisit.set(b.student_id, b.checked_in_at);
  }
  if (!lastVisit.size) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, phone, is_active")
    .in("id", [...lastVisit.keys()]);

  return (students ?? [])
    .filter((s) => s.is_active)
    .map((s) => {
      const days = Math.floor((now.getTime() - new Date(lastVisit.get(s.id) ?? 0).getTime()) / 86_400_000);
      return {
        studentId: s.id,
        name: s.full_name,
        phone: s.phone,
        detail: `Sin clases disponibles · vino ${days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`}`,
      };
    });
}

/** Vinieron a la clase de prueba (últimos 30 días) y todavía no compraron ningún pack. */
export async function trialNotConverted(studioId: string, now: Date): Promise<FollowUp[]> {
  const supabase = await createClient();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { data: trials } = await supabase
    .from("bookings")
    .select("student_id, checked_in_at")
    .eq("studio_id", studioId)
    .eq("is_trial", true)
    .eq("status", "attended")
    .gte("checked_in_at", since)
    .order("checked_in_at", { ascending: false });
  const ids = [...new Set((trials ?? []).map((t) => t.student_id))];
  if (!ids.length) return [];

  const [{ data: students }, { data: packs }] = await Promise.all([
    supabase.from("students").select("id, full_name, phone, is_active").in("id", ids),
    supabase.from("student_packs").select("student_id, partner_student_id").eq("studio_id", studioId),
  ]);
  const bought = new Set((packs ?? []).flatMap((p) => [p.student_id, p.partner_student_id]).filter(Boolean));
  const visit = new Map((trials ?? []).map((t) => [t.student_id, t.checked_in_at]));

  return (students ?? [])
    .filter((s) => s.is_active && !bought.has(s.id))
    .map((s) => {
      const days = Math.floor((now.getTime() - new Date(visit.get(s.id) ?? 0).getTime()) / 86_400_000);
      return {
        studentId: s.id,
        name: s.full_name,
        phone: s.phone,
        detail: `Probó una clase ${days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`} y no compró`,
      };
    });
}

export type SlotOccupancy = {
  key: string;
  title: string;
  label: string;
  sessions: number;
  avgBooked: number;
  capacity: number;
  pct: number;
  avgLeaders: number;
  avgFollowers: number;
  roleBalance: boolean;
  hint: "full" | "low" | null;
};

/** Ocupación promedio por clase y horario en las últimas `weeks` semanas. */
export async function occupancyBySlot(studioId: string, tz: string, now: Date, weeks = 4): Promise<SlotOccupancy[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: offerings }] = await Promise.all([
    supabase
      .from("session_occupancy")
      .select("offering_id, starts_at, status, capacity, booked_count, leader_count, follower_count")
      .eq("studio_id", studioId)
      .eq("status", "scheduled")
      .gte("starts_at", new Date(now.getTime() - weeks * 7 * 86_400_000).toISOString())
      .lt("starts_at", now.toISOString()),
    supabase.from("offerings").select("id, title, disciplines(features)").eq("studio_id", studioId),
  ]);
  const byOffering = new Map((offerings ?? []).map((o) => [o.id, o]));
  const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const groups = new Map<string, { title: string; label: string; n: number; booked: number; cap: number; lid: number; seg: number; rb: boolean }>();
  for (const r of rows ?? []) {
    if (!r.offering_id || !r.starts_at) continue;
    const o = byOffering.get(r.offering_id);
    if (!o) continue;
    const local = toYmd(new Date(r.starts_at), tz);
    const time = formatTime(r.starts_at, tz);
    const key = `${r.offering_id}|${weekdayOf(local)}|${time}`;
    const g =
      groups.get(key) ??
      {
        title: o.title,
        label: `${WEEKDAYS[weekdayOf(local)]} ${time}`,
        n: 0,
        booked: 0,
        cap: 0,
        lid: 0,
        seg: 0,
        rb: Boolean((o.disciplines?.features as { role_balance?: boolean } | null)?.role_balance),
      };
    g.n += 1;
    g.booked += r.booked_count ?? 0;
    g.cap += r.capacity ?? 0;
    g.lid += r.leader_count ?? 0;
    g.seg += r.follower_count ?? 0;
    groups.set(key, g);
  }

  return [...groups.entries()]
    .map(([key, g]) => {
      const pct = g.cap ? Math.round((g.booked / g.cap) * 100) : 0;
      return {
        key,
        title: g.title,
        label: g.label,
        sessions: g.n,
        avgBooked: Math.round((g.booked / g.n) * 10) / 10,
        capacity: Math.round(g.cap / g.n),
        pct,
        avgLeaders: Math.round((g.lid / g.n) * 10) / 10,
        avgFollowers: Math.round((g.seg / g.n) * 10) / 10,
        roleBalance: g.rb,
        hint: pct >= 85 ? ("full" as const) : pct < 35 ? ("low" as const) : null,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Link de WhatsApp con un mensaje precargado (números de Argentina). */
export function whatsappLink(phone: string | null, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `549${digits}`; // 11 5555-5555 → 5491155555555
  if (digits.length < 11) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
