import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { listAgenda, type AgendaSession } from "@/lib/agenda.server";
import { addDaysYmd, formatDayLabel, formatTime, isYmd, nowMs, startOfDay, todayYmd, toYmd } from "@/lib/datetime";
import { SessionRow } from "@/components/panel/session-row";
import { generateSessions } from "../clases/actions";
import { cancelSession } from "./actions";
import { CancelSessionButton, GenerateButton } from "./agenda-actions";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ params, searchParams }: PageProps<"/s/[slug]/panel/agenda">) {
  const { slug } = await params;
  const { studio, isAdmin } = await requireStaff(slug, "/panel/agenda");
  const tz = studio.timezone;

  const today = todayYmd(tz);
  const desdeParam = (await searchParams).desde;
  const from = isYmd(desdeParam) ? desdeParam : today;
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(from, i));

  const sessions = await listAgenda(studio.id, startOfDay(from, tz), startOfDay(addDaysYmd(from, 7), tz));
  const byDay = new Map<string, AgendaSession[]>();
  for (const s of sessions) {
    const day = toYmd(new Date(s.startsAt), tz);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const now = nowMs();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/panel/agenda?desde=${addDaysYmd(from, -7)}`} className="rounded-lg px-3 py-2 hover:bg-surface">
            ← Anterior
          </Link>
          {from !== today ? (
            <Link href="/panel/agenda" className="rounded-lg px-3 py-2 hover:bg-surface">
              Hoy
            </Link>
          ) : null}
          <Link href={`/panel/agenda?desde=${addDaysYmd(from, 7)}`} className="rounded-lg px-3 py-2 hover:bg-surface">
            Siguiente →
          </Link>
        </div>
      </div>

      {isAdmin ? <GenerateButton generate={generateSessions.bind(null, slug)} /> : null}

      <div className="space-y-6">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          return (
            <section key={day} className="space-y-2">
              <h2 className={`text-sm font-semibold ${day === today ? "text-brand" : "text-muted"}`}>
                {day === today ? "Hoy · " : ""}
                {formatDayLabel(day)}
              </h2>
              {list.length === 0 ? (
                <p className="text-sm text-muted">Sin clases.</p>
              ) : (
                list.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    timeZone={tz}
                    action={
                      isAdmin && s.status === "scheduled" && new Date(s.startsAt).getTime() > now ? (
                        <CancelSessionButton
                          label={`${s.title} del ${formatDayLabel(day).toLowerCase()} a las ${formatTime(s.startsAt, tz)}`}
                          cancel={cancelSession.bind(null, slug, s.id)}
                        />
                      ) : undefined
                    }
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
