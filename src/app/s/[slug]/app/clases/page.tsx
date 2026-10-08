import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { listPublicSessions, type PublicSession } from "@/lib/public-schedule.server";
import { balanceHeadline, myBalances, myUpcomingBookings } from "@/lib/student-data.server";
import { addDaysYmd, formatDayLabel, isYmd, nowMs, startOfDay, todayYmd, toYmd, weekdayOf } from "@/lib/datetime";
import { SessionCard } from "@/components/studio/session-card";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { bookSession, bookTrialClass, joinWaitlist, leaveWaitlist } from "../actions";
import { BookButton } from "../booking-buttons";

export const metadata: Metadata = { title: "Clases" };

const DAYS_AHEAD = 14;
const WEEKDAY_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const PERIODS = [
  { key: "manana", label: "Mañana", until: 13 },
  { key: "tarde", label: "Tarde", until: 19 },
  { key: "noche", label: "Noche", until: 24 },
] as const;

function hourIn(iso: string, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
}

export default async function StudentClassesPage({ params, searchParams }: PageProps<"/s/[slug]/app/clases">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app/clases");
  const tz = studio.timezone;
  const now = nowMs();
  const today = todayYmd(tz);
  const lastDay = addDaysYmd(today, DAYS_AHEAD - 1);

  const supabase = await createClient();
  const [sessions, bookings, balances, waitlistOn, { data: myWaitlist }, { data: trialAvailable }] = await Promise.all([
    listPublicSessions(slug, new Date(now), startOfDay(addDaysYmd(today, DAYS_AHEAD), tz)),
    myUpcomingBookings(studio.id, student.id, new Date(now)),
    myBalances(studio.id, student.id),
    can(studio.id, "waitlist"),
    supabase.rpc("my_waitlist", { p_studio_id: studio.id }),
    supabase.rpc("my_trial_available", { p_studio_id: studio.id }),
  ]);
  // Clase de prueba: solo para quien nunca compró un pack (lo valida la base).
  const trial = Boolean(trialAvailable) && balances.length === 0;
  const waitingAt = new Map((myWaitlist ?? []).map((w) => [w.session_id, w.position]));
  const booked = new Set(bookings.map((b) => b.sessionId));

  const byDay = new Map<string, PublicSession[]>();
  for (const s of sessions) {
    const day = toYmd(new Date(s.startsAt), tz);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const bookedDays = new Set(bookings.map((b) => toYmd(new Date(b.startsAt), tz)));

  // Día elegido: el de la URL, o hoy si quedan clases, o el próximo con clases.
  const dia = (await searchParams).dia;
  const firstWithClasses = [...byDay.keys()].sort()[0] ?? today;
  const selected = isYmd(dia) && dia >= today && dia <= lastDay ? dia : byDay.has(today) ? today : firstWithClasses;
  const daySessions = byDay.get(selected) ?? [];
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysYmd(today, i));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold">Clases</h1>
        {trial ? (
          <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
            Tenés una <span className="font-semibold">clase de prueba gratis</span>: elegí cuál querés probar.
          </p>
        ) : (
          <p className={`text-sm ${balances.length ? "text-muted" : "text-danger"}`}>
            {balanceHeadline(balances)}.{" "}
            {balances.length === 0 ? (
              <Link href="/app/packs" className="font-medium text-brand">
                Ver packs
              </Link>
            ) : null}
          </p>
        )}
      </div>

      {/* Tira de días: punto lleno = tenés reserva; punto vacío = hay clases. */}
      <nav aria-label="Días" className="-mx-5 flex snap-x scroll-px-5 gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {days.map((d) => {
          const active = d === selected;
          const hasClasses = byDay.has(d);
          return (
            <Link
              key={d}
              href={`/app/clases?dia=${d}`}
              scroll={false}
              aria-current={active ? "date" : undefined}
              className={`flex w-12 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors ${
                active ? "bg-brand text-brand-foreground" : hasClasses ? "hover:bg-border/40" : "opacity-40"
              }`}
            >
              <span className={`text-[10px] font-medium tracking-wider ${active ? "opacity-80" : "text-muted"}`}>
                {d === today ? "HOY" : WEEKDAY_SHORT[weekdayOf(d)]}
              </span>
              <span className="text-lg leading-tight font-semibold tabular-nums">{Number(d.slice(8, 10))}</span>
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  bookedDays.has(d)
                    ? active
                      ? "bg-[var(--gold,#c8a46b)]"
                      : "bg-brand"
                    : hasClasses
                      ? `border ${active ? "border-current/60" : "border-muted/60"}`
                      : ""
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <p className="text-sm font-medium text-muted">{selected === today ? "Hoy" : formatDayLabel(selected)}</p>

      {daySessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-muted">No hay clases este día.</div>
      ) : (
        PERIODS.map((period, i) => {
          const from = i === 0 ? 0 : PERIODS[i - 1]!.until;
          const list = daySessions.filter((s) => {
            const h = hourIn(s.startsAt, tz);
            return h >= from && h < period.until;
          });
          if (!list.length) return null;
          return (
            <section key={period.key} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-medium tracking-widest text-muted uppercase">{period.label}</h2>
                <span className="h-px flex-1 bg-border" />
              </div>
              {list.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  timeZone={tz}
                  booked={booked.has(s.id)}
                  action={
                    s.cancelled || booked.has(s.id) ? undefined : (
                      <BookButton
                        book={(trial ? bookTrialClass : bookSession).bind(null, slug, s.id)}
                        label={trial ? "Probar gratis" : undefined}
                        roleBalance={s.roleBalance}
                        leaders={s.leaders}
                        followers={s.followers}
                        maxDiff={s.maxDiff}
                        defaultRole={student.default_role}
                        full={s.spotsLeft <= 0}
                        waitlist={
                          waitlistOn
                            ? {
                                position: waitingAt.get(s.id) ?? null,
                                join: joinWaitlist.bind(null, slug, s.id),
                                leave: leaveWaitlist.bind(null, slug, s.id),
                              }
                            : undefined
                        }
                      />
                    )
                  }
                />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
