import { addDaysYmd, formatDayLabel, formatTime, todayYmd, toYmd } from "@/lib/datetime";

// Textos del Inicio del alumno. Funciones puras (se prueban sin base).

const MIN = 60_000;

/** "Buen día" / "Buenas tardes" / "Buenas noches" según la hora local del estudio. */
export function greeting(now: Date, timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour >= 5 && hour < 13) return "Buen día";
  if (hour >= 13 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Cuánto falta para la clase: "En curso", "en 25 min", "en 2 h 15 min", "Mañana 19:00", "Lunes 6/10 · 19:00". */
export function untilLabel(startsAt: string, now: Date, timeZone: string): string {
  const diff = new Date(startsAt).getTime() - now.getTime();
  if (diff <= 0) return "En curso";
  if (diff < 60 * MIN) return `en ${Math.max(1, Math.round(diff / MIN))} min`;
  if (diff < 6 * 60 * MIN) {
    const h = Math.floor(diff / (60 * MIN));
    const m = Math.round((diff - h * 60 * MIN) / MIN);
    return m === 0 || m === 60 ? `en ${m === 60 ? h + 1 : h} h` : `en ${h} h ${m} min`;
  }
  const day = toYmd(new Date(startsAt), timeZone);
  const today = todayYmd(timeZone, now);
  const time = formatTime(startsAt, timeZone);
  if (day === today) return `Hoy ${time}`;
  if (day === addDaysYmd(today, 1)) return `Mañana ${time}`;
  return `${formatDayLabel(day)} · ${time}`;
}

/** El presente se da desde 30 minutos antes hasta que termina (igual que self_check_in). */
export function inCheckinWindow(startsAt: string, endsAt: string, now: Date): boolean {
  const t = now.getTime();
  return t >= new Date(startsAt).getTime() - 30 * MIN && t <= new Date(endsAt).getTime();
}

/** Asistencias por semana del mes (1-7, 8-14, 15-21, 22-28, 29+). */
export function weeklyCounts(days: number[]): number[] {
  const weeks = [0, 0, 0, 0, 0];
  for (const d of days) weeks[Math.min(4, Math.floor((d - 1) / 7))]! += 1;
  return weeks;
}
