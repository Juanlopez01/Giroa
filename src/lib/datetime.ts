// Fechas en la zona horaria del estudio, sin dependencias. Una fecha "local"
// se maneja como string YYYY-MM-DD; los instantes, como Date (UTC).

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

function parts(date: Date, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Diferencia entre la hora local de la zona y UTC en ese instante (ms). */
function offsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isYmd(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Fecha local (YYYY-MM-DD) de un instante en la zona. */
export function toYmd(date: Date, timeZone: string): string {
  const p = parts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayYmd(timeZone: string, now = new Date()): string {
  return toYmd(now, timeZone);
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Instante (UTC) en que empieza ese día en la zona del estudio. */
export function startOfDay(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Segunda pasada por si el offset cambia ese día (horario de verano).
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "19:00" */
export function formatTime(date: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(date),
  );
}

/** "Lunes 6/10" */
export function formatDayLabel(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return `${WEEKDAYS[weekdayOf(ymd)]} ${d}/${m}`;
}

/** "19:00" desde un time de Postgres ("19:00:00"). */
export function trimTime(time: string): string {
  return time.slice(0, 5);
}

/** Instante actual. Separado para que los Server Components no llamen Date.now() en el render. */
export function nowMs(): number {
  return Date.now();
}

/** Instante (UTC) de una fecha y hora locales del estudio ("2026-10-10", "21:30"). */
export function zonedDateTime(ymd: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** "21:30" en la zona (para precargar un input type="time"). */
export function toHhmm(date: Date | string, timeZone: string): string {
  const p = parts(new Date(date), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
