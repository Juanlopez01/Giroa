import { addDaysYmd, formatDayLabel, formatTime, toYmd, zonedDateTime } from "@/lib/datetime";

/** Inicio y fin del evento a partir de fecha + horas locales. Si termina antes de
 *  la hora de inicio, termina al día siguiente (una milonga hasta las 3). */
export function eventInstants(
  date: string,
  startTime: string,
  endTime: string | null,
  timeZone: string,
): { startsAt: Date; endsAt: Date | null } {
  const startsAt = zonedDateTime(date, startTime, timeZone);
  if (!endTime) return { startsAt, endsAt: null };
  const endDate = endTime <= startTime ? addDaysYmd(date, 1) : date;
  return { startsAt, endsAt: zonedDateTime(endDate, endTime, timeZone) };
}

/** "Sábado 10/10 · 21:30 a 03:00" */
export function formatEventWhen(startsAt: string | Date, endsAt: string | Date | null, timeZone: string): string {
  const day = formatDayLabel(toYmd(new Date(startsAt), timeZone));
  const from = formatTime(startsAt, timeZone);
  return endsAt ? `${day} · ${from} a ${formatTime(endsAt, timeZone)}` : `${day} · ${from}`;
}

export const EVENT_STATUS_LABEL = {
  draft: "Borrador",
  published: "Publicado",
  cancelled: "Cancelado",
} as const;

export const ORDER_STATUS_LABEL = {
  pending: "Pendiente de pago",
  paid: "Pagada",
  expired: "Vencida",
  cancelled: "Cancelada",
  refunded: "Reintegrada",
} as const;
