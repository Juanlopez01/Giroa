import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireStudent } from "@/lib/student-app";
import { myPastBookings, myUpcomingBookings, type MyBooking } from "@/lib/student-data.server";
import { formatTime, nowMs, toYmd, weekdayOf } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";
import { untilLabel } from "@/lib/student-home";
import { cancelBooking } from "../actions";
import { CancelBookingButton } from "../booking-buttons";

export const metadata: Metadata = { title: "Mis reservas" };

const WEEKDAY_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Bloque de fecha a la izquierda: "VIE / 9 / oct". */
function DateBlock({ startsAt, timeZone, muted = false }: { startsAt: string; timeZone: string; muted?: boolean }) {
  const ymd = toYmd(new Date(startsAt), timeZone);
  return (
    <div className={`flex w-12 shrink-0 flex-col items-center rounded-2xl py-2 ${muted ? "bg-border/40 text-muted" : "bg-brand/10 text-brand"}`}>
      <span className="text-[10px] font-medium tracking-wider">{WEEKDAY_SHORT[weekdayOf(ymd)]}</span>
      <span className="text-lg leading-tight font-semibold tabular-nums">{Number(ymd.slice(8, 10))}</span>
      <span className="text-[10px]">{MONTHS[Number(ymd.slice(5, 7)) - 1]}</span>
    </div>
  );
}

function PastStatus({ b }: { b: MyBooking }) {
  if (b.sessionCancelled) return <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-xs font-medium text-muted">Cancelada</span>;
  if (b.status === "attended")
    return <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Presente ✓</span>;
  return <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-xs font-medium text-muted">Sin presente</span>;
}

export default async function MyBookingsPage({ params, searchParams }: PageProps<"/s/[slug]/app/reservas">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app/reservas");
  const tz = studio.timezone;
  const now = new Date(nowMs());
  const past = (await searchParams).ver === "pasadas";
  const bookings = past ? await myPastBookings(studio.id, student.id, now) : await myUpcomingBookings(studio.id, student.id, now);

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`h-9 rounded-full px-4 text-sm leading-9 font-medium ${active ? "bg-brand text-brand-foreground" : "bg-border/50 text-muted"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-semibold">Mis reservas</h1>
      <div className="flex gap-2">
        {tab("/app/reservas", "Próximas", !past)}
        {tab("/app/reservas?ver=pasadas", "Pasadas", past)}
      </div>

      {bookings.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-border p-5 text-center">
          <p className="text-muted">{past ? "Todavía no tenés clases pasadas." : "No tenés clases reservadas."}</p>
          {!past ? (
            <Link href="/app/clases" className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-brand-foreground">
              Ver los horarios
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const startsMs = new Date(b.startsAt).getTime();
            const started = startsMs <= now.getTime();
            const insideWindow = startsMs - now.getTime() < studio.cancel_window_hours * 3_600_000;
            return (
              <li key={b.id} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
                <DateBlock startsAt={b.startsAt} timeZone={tz} muted={past || b.sessionCancelled} />
                <div className="min-w-0 flex-1 space-y-2 py-0.5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{b.title}</p>
                      {past ? <PastStatus b={b} /> : b.status === "attended" ? <PastStatus b={b} /> : null}
                    </div>
                    <p className="text-sm text-muted">
                      {formatTime(b.startsAt, tz)}
                      {b.role ? ` · ${ROLE_LABELS[b.role]}` : ""}
                      {!past && !b.sessionCancelled && !started && untilLabel(b.startsAt, now, tz).startsWith("en ") ? ` · ${untilLabel(b.startsAt, now, tz)}` : ""}
                    </p>
                    {!past && b.sessionCancelled ? <p className="text-sm text-danger">El estudio canceló esta clase</p> : null}
                  </div>
                  {!past && !b.sessionCancelled && b.status === "booked" ? (
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={`/app/reservas/${b.id}/calendario`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full px-1 text-sm font-medium text-brand"
                      >
                        <CalendarPlus className="h-4 w-4" aria-hidden /> Agendar
                      </a>
                      {!started ? (
                        <CancelBookingButton
                          cancel={cancelBooking.bind(null, slug, b.id)}
                          insideWindow={insideWindow}
                          windowHours={studio.cancel_window_hours}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!past ? <p className="text-xs text-muted">Podés cancelar hasta {studio.cancel_window_hours} h antes y te devolvemos la clase.</p> : null}
    </div>
  );
}
