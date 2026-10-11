// Alerta de abandono: alumnos que venían seguido y dejaron de venir.

export const CHURN_DAYS_OPTIONS = [14, 21, 30] as const;
/** Ventana en la que se mide si "venía seguido" (antes de los días sin venir). */
export const CHURN_HISTORY_DAYS = 60;
/** Mínimo de clases en esa ventana para considerar que venía seguido. */
export const CHURN_MIN_VISITS = 3;

const DAY = 86_400_000;

export type ChurnCandidate = { studentId: string; visits: number; lastVisit: Date; daysAway: number };

/**
 * Venía seguido (≥ 3 clases en los 60 días anteriores), no viene hace `days`
 * días o más y no tiene ninguna clase reservada a futuro.
 */
export function detectChurn(
  visits: { studentId: string; at: Date }[],
  withFutureBooking: Set<string>,
  now: Date,
  days: number,
): ChurnCandidate[] {
  const cutoff = now.getTime() - days * DAY;
  const historyFrom = cutoff - CHURN_HISTORY_DAYS * DAY;
  const byStudent = new Map<string, { visits: number; last: number }>();
  for (const v of visits) {
    const t = v.at.getTime();
    const cur = byStudent.get(v.studentId) ?? { visits: 0, last: 0 };
    if (t >= historyFrom && t < cutoff) cur.visits++;
    cur.last = Math.max(cur.last, t);
    byStudent.set(v.studentId, cur);
  }
  const out: ChurnCandidate[] = [];
  for (const [studentId, { visits: n, last }] of byStudent) {
    if (n < CHURN_MIN_VISITS || last >= cutoff || withFutureBooking.has(studentId)) continue;
    out.push({ studentId, visits: n, lastVisit: new Date(last), daysAway: Math.floor((now.getTime() - last) / DAY) });
  }
  // Primero los que venían más seguido.
  return out.sort((a, b) => b.visits - a.visits || a.daysAway - b.daysAway);
}

/** "Venía 2 veces por semana" / "Venía 3 veces por mes" (según las clases de los 60 días). */
export function usedToComeLabel(visits: number): string {
  const perWeek = Math.round(visits / (CHURN_HISTORY_DAYS / 7));
  if (perWeek >= 1) return `Venía ${perWeek === 1 ? "1 vez" : `${perWeek} veces`} por semana`;
  const perMonth = Math.max(1, Math.round(visits / (CHURN_HISTORY_DAYS / 30)));
  return `Venía ${perMonth === 1 ? "1 vez" : `${perMonth} veces`} por mes`;
}
