import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { myUpcomingBookings } from "@/lib/student-data.server";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";
import { cancelBooking } from "../actions";
import { CancelBookingButton } from "../booking-buttons";

export const metadata: Metadata = { title: "Mis reservas" };

export default async function MyBookingsPage({ params }: PageProps<"/s/[slug]/app/reservas">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app/reservas");
  const tz = studio.timezone;
  const now = nowMs();
  const bookings = await myUpcomingBookings(studio.id, student.id, new Date(now));

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold">Mis reservas</h1>

      {bookings.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <p className="font-medium">No tenés clases reservadas</p>
          <Link href="/app/clases" className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-brand-foreground">
            Ver los horarios
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const startsMs = new Date(b.startsAt).getTime();
            const started = startsMs <= now;
            const insideWindow = startsMs - now < studio.cancel_window_hours * 3_600_000;
            return (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-sm text-muted">
                    {formatDayLabel(toYmd(new Date(b.startsAt), tz))} · {formatTime(b.startsAt, tz)}
                    {b.role ? ` · ${ROLE_LABELS[b.role]}` : ""}
                  </p>
                  {b.sessionCancelled ? <p className="text-sm text-danger">El estudio canceló esta clase</p> : null}
                </div>
                {b.status === "attended" ? (
                  <span className="text-sm font-medium text-success">Presente ✓</span>
                ) : !started && !b.sessionCancelled ? (
                  <CancelBookingButton
                    cancel={cancelBooking.bind(null, slug, b.id)}
                    insideWindow={insideWindow}
                    windowHours={studio.cancel_window_hours}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">Podés cancelar hasta {studio.cancel_window_hours} h antes y te devolvemos la clase.</p>
    </div>
  );
}
