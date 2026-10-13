// Liquidación de profes: aplica las reglas de cada clase (payout_rules) a los
// números de las clases dictadas (payout_sessions). Funciones puras.

import { formatArs } from "@/lib/money";
import { startOfDay } from "@/lib/datetime";

export type PayoutKind = "per_class" | "per_student" | "percent";

export type PayoutRule = {
  offeringId: string;
  payeeName: string;
  memberId: string | null;
  kind: PayoutKind;
  amountCents: number | null;
  percent: number | null;
};

export type PayoutSession = {
  sessionId: string;
  offeringId: string;
  title: string;
  startsAt: string;
  present: number;
  used: number;
  revenueCents: number;
};

export type PayoutLine = {
  sessionId: string;
  title: string;
  startsAt: string;
  present: number;
  revenueCents: number;
  kind: PayoutKind;
  rule: string;
  earnedCents: number;
};

export type Payee = {
  key: string;
  name: string;
  memberId: string | null;
  totalCents: number;
  classes: number;
  students: number;
  lines: PayoutLine[];
};

/** Igual que private.payee_key: el mismo profe en todas sus clases (por su cuenta o por su nombre). */
export function payeeKey(memberId: string | null, name: string): string {
  return memberId ?? `n:${name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

export function earned(rule: Pick<PayoutRule, "kind" | "amountCents" | "percent">, s: Pick<PayoutSession, "present" | "revenueCents">): number {
  if (rule.kind === "per_class") return rule.amountCents ?? 0;
  if (rule.kind === "per_student") return (rule.amountCents ?? 0) * s.present;
  // El porcentaje se redondea a pesos enteros (nadie paga centavos).
  return Math.round((s.revenueCents * (rule.percent ?? 0)) / 10000) * 100;
}

export function describeRule(rule: Pick<PayoutRule, "kind" | "amountCents" | "percent">): string {
  if (rule.kind === "per_class") return `${formatArs(rule.amountCents ?? 0)} por clase`;
  if (rule.kind === "per_student") return `${formatArs(rule.amountCents ?? 0)} por alumno presente`;
  return `${String(rule.percent ?? 0).replace(".", ",")}% de lo que generó la clase`;
}

/** Lo que le toca a cada profe, de mayor a menor. */
export function computePayouts(sessions: PayoutSession[], rules: PayoutRule[]): Payee[] {
  const byOffering = new Map<string, PayoutRule[]>();
  for (const r of rules) byOffering.set(r.offeringId, [...(byOffering.get(r.offeringId) ?? []), r]);

  const payees = new Map<string, Payee>();
  for (const s of [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    for (const r of byOffering.get(s.offeringId) ?? []) {
      const key = payeeKey(r.memberId, r.payeeName);
      const p = payees.get(key) ?? { key, name: r.payeeName.trim(), memberId: r.memberId, totalCents: 0, classes: 0, students: 0, lines: [] };
      const amount = earned(r, s);
      p.totalCents += amount;
      p.classes += 1;
      p.students += s.present;
      p.lines.push({
        sessionId: s.sessionId,
        title: s.title,
        startsAt: s.startsAt,
        present: s.present,
        revenueCents: s.revenueCents,
        kind: r.kind,
        rule: describeRule(r),
        earnedCents: amount,
      });
      payees.set(key, p);
    }
  }
  return [...payees.values()].sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, "es"));
}

/** "AAAA-MM" válido o null. */
export function parseMonth(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Del primer día del mes al primero del siguiente, en la hora del estudio. */
export function monthRange(ym: string, timeZone: string): { from: Date; to: Date } {
  return { from: startOfDay(`${ym}-01`, timeZone), to: startOfDay(`${shiftMonth(ym, 1)}-01`, timeZone) };
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}
