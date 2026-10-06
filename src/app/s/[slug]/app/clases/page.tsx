import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { listPublicSessions, type PublicSession } from "@/lib/public-schedule.server";
import { balanceHeadline, myBalances, myUpcomingBookings } from "@/lib/student-data.server";
import { addDaysYmd, formatDayLabel, isYmd, nowMs, startOfDay, todayYmd, toYmd } from "@/lib/datetime";
import { SessionCard } from "@/components/studio/session-card";
import { bookSession } from "../actions";
import { BookButton } from "../booking-buttons";

export const metadata: Metadata = { title: "Reservar" };

export default async function StudentClassesPage({ params, searchParams }: PageProps<"/s/[slug]/app/clases">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app/clases");
  const tz = studio.timezone;
  const now = nowMs();

  const today = todayYmd(tz);
  const desde = (await searchParams).desde;
  const from = isYmd(desde) && desde >= today ? desde : today;

  const [sessions, bookings, balances] = await Promise.all([
    listPublicSessions(slug, from === today ? new Date(now) : startOfDay(from, tz), startOfDay(addDaysYmd(from, 7), tz)),
    myUpcomingBookings(studio.id, student.id, new Date(now)),
    myBalances(studio.id, student.id),
  ]);
  const booked = new Set(bookings.map((b) => b.sessionId));

  const byDay = new Map<string, PublicSession[]>();
  for (const s of sessions) {
    const day = toYmd(new Date(s.startsAt), tz);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const days = [...byDay.keys()];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Reservar</h1>
        <p className={`text-sm ${balances.length ? "text-muted" : "text-danger"}`}>{balanceHeadline(balances)}.</p>
      </div>

      {days.length === 0 ? (
        <p className="text-muted">No hay clases programadas para estos días.</p>
      ) : (
        days.map((day) => (
          <section key={day} className="space-y-2">
            <h2 className={`text-sm font-semibold ${day === today ? "text-brand" : "text-muted"}`}>
              {day === today ? "Hoy · " : ""}
              {formatDayLabel(day)}
            </h2>
            {(byDay.get(day) ?? []).map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                timeZone={tz}
                action={
                  s.cancelled ? undefined : booked.has(s.id) ? (
                    <span className="text-sm font-medium text-success">Reservada ✓</span>
                  ) : (
                    <BookButton
                      book={bookSession.bind(null, slug, s.id)}
                      roleBalance={s.roleBalance}
                      leaders={s.leaders}
                      followers={s.followers}
                      maxDiff={s.maxDiff}
                      defaultRole={student.default_role}
                      full={s.spotsLeft <= 0}
                    />
                  )
                }
              />
            ))}
          </section>
        ))
      )}

      <div className="flex justify-between text-sm">
        {from > today ? (
          <Link href={`/app/clases?desde=${addDaysYmd(from, -7) < today ? today : addDaysYmd(from, -7)}`} className="text-muted">
            ← Antes
          </Link>
        ) : (
          <span />
        )}
        <Link href={`/app/clases?desde=${addDaysYmd(from, 7)}`} className="font-medium text-brand">
          Próxima semana →
        </Link>
      </div>
    </div>
  );
}
