// Restricciones de un pack ("Solo yoga", "Lunes a viernes", "Antes de las 17").
// Misma forma que pack_products.rules / student_packs.rules en la base.

export type PackRules = {
  disciplines?: string[];
  offerings?: string[];
  /** 0 = domingo … 6 = sábado. */
  weekdays?: number[];
  /** "HH:MM": la clase empieza desde esta hora… */
  from?: string;
  /** …y antes de esta. */
  until?: string;
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Normaliza lo que viene de la base o del formulario (descarta lo inválido). */
export function parsePackRules(raw: unknown): PackRules {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const strings = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))] : []);
  const out: PackRules = {};
  const disciplines = strings(r.disciplines);
  const offerings = strings(r.offerings);
  const weekdays = Array.isArray(r.weekdays)
    ? [...new Set(r.weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  if (disciplines.length) out.disciplines = disciplines;
  if (offerings.length) out.offerings = offerings;
  if (weekdays.length && weekdays.length < 7) out.weekdays = weekdays;
  if (typeof r.from === "string" && HHMM.test(r.from)) out.from = r.from;
  if (typeof r.until === "string" && HHMM.test(r.until)) out.until = r.until;
  return out;
}

export function hasRules(rules: PackRules): boolean {
  return Object.keys(rules).length > 0;
}

/** "Lun a Vie", "Lun, Mié y Vie", "Sáb y Dom". */
function describeDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // semana de lunes a domingo
  const idx = sorted.map((d) => (d + 6) % 7);
  const consecutive = idx.length >= 3 && idx.every((v, i) => i === 0 || v === idx[i - 1]! + 1);
  if (consecutive) return `${DAY_SHORT[sorted[0]!]} a ${DAY_SHORT[sorted[sorted.length - 1]!]}`;
  const names = sorted.map((d) => DAY_SHORT[d]!);
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/**
 * Texto corto para mostrar: "Solo Yoga y Pilates · Lun a Vie · Antes de las 17:00".
 * Devuelve null si el pack vale para todo.
 */
export function describePackRules(
  rules: PackRules,
  names: { disciplines?: Record<string, string>; offerings?: Record<string, string> } = {},
): string | null {
  const parts: string[] = [];
  const what = [
    ...(rules.disciplines ?? []).map((k) => names.disciplines?.[k] ?? k),
    ...(rules.offerings ?? []).map((id) => names.offerings?.[id] ?? "una clase"),
  ];
  if (what.length) parts.push(`Solo ${what.length === 1 ? what[0] : `${what.slice(0, -1).join(", ")} y ${what[what.length - 1]}`}`);
  if (rules.weekdays?.length) parts.push(describeDays(rules.weekdays));
  if (rules.from && rules.until) parts.push(`De ${rules.from} a ${rules.until}`);
  else if (rules.until) parts.push(`Antes de las ${rules.until}`);
  else if (rules.from) parts.push(`Desde las ${rules.from}`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * ¿El pack sirve para esta clase? Misma regla que private.pack_rules_allow en la
 * base (que es la que decide al reservar): disciplina o clase, día de la semana
 * y horario de inicio, en la hora local del estudio. Sirve para ofrecer de
 * entrada "Reservar suelta" cuando ningún pack vale.
 */
export function packRulesAllow(
  rules: PackRules,
  session: { disciplineKey: string; offeringId: string; startsAt: string },
  timeZone: string,
): boolean {
  const lists = Boolean(rules.disciplines?.length || rules.offerings?.length);
  if (lists && !(rules.disciplines?.includes(session.disciplineKey) || rules.offerings?.includes(session.offeringId))) return false;
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(session.startsAt));
  const part = (t: string) => local.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
  const hhmm = `${part("hour")}:${part("minute")}`;
  if (rules.weekdays?.length && !rules.weekdays.includes(dow)) return false;
  if (rules.from && hhmm < rules.from) return false;
  if (rules.until && hhmm >= rules.until) return false;
  return true;
}
