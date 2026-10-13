import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computePayouts, monthRange, type Payee, type PayoutKind } from "@/lib/payouts";

export type PaidPayout = {
  id: string;
  payeeKey: string;
  payeeName: string;
  memberId: string | null;
  amountCents: number;
  method: "cash" | "transfer" | "mercadopago";
  paidAt: string;
  note: string | null;
};

export type MonthPayouts = { payees: Payee[]; paid: Map<string, PaidPayout> };

/**
 * Liquidación de un mes ("AAAA-MM"): lo que le toca a cada profe con las reglas
 * de hoy y lo que ya se marcó como pagado. Un profe ve solo lo suyo (RLS).
 */
export async function loadMonthPayouts(studioId: string, ym: string, timeZone: string): Promise<MonthPayouts> {
  const supabase = await createClient();
  const { from, to } = monthRange(ym, timeZone);
  const [{ data: sessions, error }, { data: rules }, { data: paid }] = await Promise.all([
    supabase.rpc("payout_sessions", { p_studio_id: studioId, p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.from("payout_rules").select("offering_id, payee_name, member_id, kind, amount_cents, percent").eq("studio_id", studioId).order("created_at"),
    supabase
      .from("teacher_payouts")
      .select("id, payee_key, payee_name, member_id, amount_cents, method, paid_at, note")
      .eq("studio_id", studioId)
      .eq("period", `${ym}-01`),
  ]);
  // Un profe sin reglas a su nombre no tiene acceso: no hay nada que mostrarle.
  if (error && error.hint !== "forbidden") console.error("[loadMonthPayouts]", error);

  const payees = computePayouts(
    (sessions ?? []).map((s) => ({
      sessionId: s.session_id,
      offeringId: s.offering_id,
      title: s.title,
      startsAt: s.starts_at,
      present: s.present,
      used: s.used,
      revenueCents: s.revenue_cents,
    })),
    (rules ?? []).map((r) => ({
      offeringId: r.offering_id,
      payeeName: r.payee_name,
      memberId: r.member_id,
      kind: r.kind as PayoutKind,
      amountCents: r.amount_cents,
      percent: r.percent,
    })),
  );
  return {
    payees,
    paid: new Map(
      (paid ?? []).map((p) => [
        p.payee_key,
        {
          id: p.id,
          payeeKey: p.payee_key,
          payeeName: p.payee_name,
          memberId: p.member_id,
          amountCents: p.amount_cents,
          method: p.method,
          paidAt: p.paid_at,
          note: p.note,
        },
      ]),
    ),
  };
}
