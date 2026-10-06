import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { balanceHeadline, myBalances, myUpcomingBookings, shortDate } from "@/lib/student-data.server";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";
import { FormMessage } from "@/components/ui/field";
import { cancelBooking } from "./actions";
import { CancelBookingButton } from "./booking-buttons";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function StudentHomePage({ params, searchParams }: PageProps<"/s/[slug]/app">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app");
  const tz = studio.timezone;
  const welcome = (await searchParams).bienvenida === "1";
  const now = nowMs();

  const [balances, bookings] = await Promise.all([
    myBalances(studio.id, student.id),
    myUpcomingBookings(studio.id, student.id, new Date(now)),
  ]);
  const firstName = student.full_name.split(" ")[0];
  const nextExpiry = balances.find((b) => b.expiresOn)?.expiresOn;

  return (
    <div className="space-y-8">
      {welcome ? <FormMessage ok message={`¡Listo, ${firstName}! Ya sos parte de ${studio.name}.`} /> : null}

      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Hola, {firstName}</h1>
        <div
          className={`rounded-2xl p-5 ${balances.length ? "bg-brand text-brand-foreground" : "border border-border bg-surface"}`}
        >
          <p className="text-xl font-semibold">{balanceHeadline(balances)}</p>
          {nextExpiry ? <p className="text-sm opacity-80">Vence el {shortDate(nextExpiry)}</p> : null}
          {balances.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Comprá un pack para reservar. Podés pagarlo en el estudio.</p>
          ) : null}
        </div>
        {balances.length > 1 ? (
          <ul className="space-y-1 text-sm text-muted">
            {balances.map((b) => (
              <li key={b.id}>
                {b.name}: {b.remaining === null ? "libre" : `${b.remaining} ${b.remaining === 1 ? "clase" : "clases"}`}
                {b.expiresOn ? `, vence el ${shortDate(b.expiresOn)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Tus próximas clases</h2>
          <Link href="/app/clases" className="text-sm font-medium text-brand">
            Reservar
          </Link>
        </div>
        {bookings.length === 0 ? (
          <p className="text-muted">No tenés clases reservadas.</p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => {
              const startsMs = new Date(b.startsAt).getTime();
              const started = startsMs <= now;
              const insideWindow = startsMs - now < studio.cancel_window_hours * 3_600_000;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{b.title}</p>
                    <p className="text-sm text-muted">
                      {formatDayLabel(toYmd(new Date(b.startsAt), tz))} · {formatTime(b.startsAt, tz)}
                      {b.role ? ` · ${ROLE_LABELS[b.role]}` : ""}
                    </p>
                    {b.sessionCancelled ? <p className="text-sm text-danger">El estudio canceló esta clase</p> : null}
                  </div>
                  {b.status === "attended" ? (
                    <span className="text-sm text-success">Presente ✓</span>
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
      </section>
    </div>
  );
}
