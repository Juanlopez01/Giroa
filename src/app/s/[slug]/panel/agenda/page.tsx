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
  const { studio, isAdmin, role, memberId } = await requireStaff(slug, "/panel/agenda");
  const tz = studio.timezone;

  const today = todayYmd(tz);
  const sp = await searchParams;
  const desdeParam = sp.desde;
  const from = isYmd(desdeParam) ? desdeParam : today;
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(from, i));

  const all = await listAgenda(studio.id, startOfDay(from, tz), startOfDay(addDaysYmd(from, 7), tz));
  // El profe arranca viendo sus clases (si tiene alguna asignada); puede ver todas.
  const mine = all.filter((s) => s.teacherMemberId === memberId);
  const onlyMine = role === "teacher" && sp.todas !== "1" && mine.length > 0;
  const sessions = onlyMine ? mine : all;
  const keep = (q: string) => (sp.todas === "1" ? `${q}&todas=1` : q);
  const byDay = new Map<string, AgendaSession[]>();
  for (const s of sessions) {
    const day = toYmd(new Date(s.startsAt), tz);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const now = nowMs();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Agenda</h1>
        <div className="flex items-center gap-1.5 text-sm">
          <Link href={keep(`/panel/agenda?desde=${addDaysYmd(from, -7)}`)} className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-4 hover:border-brand/40">
            ← Anterior
          </Link>
          {from !== today ? (
            <Link href="/panel/agenda" className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-4 hover:border-brand/40">
              Hoy
            </Link>
          ) : null}
          <Link href={keep(`/panel/agenda?desde=${addDaysYmd(from, 7)}`)} className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-4 hover:border-brand/40">
            Siguiente →
          </Link>
        </div>
      </div>

      {isAdmin ? <GenerateButton generate={generateSessions.bind(null, slug)} /> : null}

      {role === "teacher" && mine.length > 0 ? (
        <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
          <Link
            href={`/panel/agenda?desde=${from}`}
            aria-current={onlyMine ? "page" : undefined}
            className="rounded-full px-4 py-1.5 font-medium text-muted aria-[current=page]:bg-brand aria-[current=page]:text-brand-foreground"
          >
            Mis clases
          </Link>
          <Link
            href={`/panel/agenda?desde=${from}&todas=1`}
            aria-current={!onlyMine ? "page" : undefined}
            className="rounded-full px-4 py-1.5 font-medium text-muted aria-[current=page]:bg-brand aria-[current=page]:text-brand-foreground"
          >
            Todas
          </Link>
        </div>
      ) : null}

      <div className="space-y-6">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          return (
            <section key={day} className="space-y-2">
              <h2 className={`flex items-center gap-3 text-xs font-medium tracking-widest uppercase after:h-px after:flex-1 after:bg-border ${day === today ? "text-brand" : "text-muted"}`}>
                {day === today ? "Hoy · " : ""}
                {formatDayLabel(day)}
              </h2>
              {list.length === 0 ? (
                <p className="px-1 text-sm text-muted">Sin clases.</p>
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
