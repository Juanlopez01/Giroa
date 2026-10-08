import Link from "next/link";
import type { AgendaSession } from "@/lib/agenda.server";
import { formatTime } from "@/lib/datetime";

/**
 * Una clase en el panel (Inicio y Agenda): la hora a la izquierda, una barra de
 * ocupación y, si ya empezó a llegar gente, cuántos dieron el presente.
 */
export function SessionRow({
  session,
  timeZone,
  action,
}: {
  session: AgendaSession;
  timeZone: string;
  action?: React.ReactNode;
}) {
  const cancelled = session.status === "cancelled";
  const full = session.booked >= session.capacity;
  const pct = session.capacity ? Math.min(100, Math.round((session.booked / session.capacity) * 100)) : 0;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 pr-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="w-14 shrink-0 text-center">
        <p className="font-semibold tabular-nums">{formatTime(session.startsAt, timeZone)}</p>
        <p className="text-xs text-muted tabular-nums">{formatTime(session.endsAt, timeZone)}</p>
      </div>
      <Link href={`/panel/agenda/${session.id}`} className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate font-semibold ${cancelled ? "line-through" : ""}`}>{session.title}</p>
          {cancelled ? (
            <span className="shrink-0 rounded-full bg-border/60 px-2 py-0.5 text-[11px] font-medium text-muted">Cancelada</span>
          ) : session.attended > 0 ? (
            <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              {session.attended} {session.attended === 1 ? "presente" : "presentes"}
            </span>
          ) : null}
        </div>
        {cancelled ? null : (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-border/60" aria-hidden>
              <div className={`h-full rounded-full ${full ? "bg-[var(--gold,#c8a46b)]" : "bg-brand"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted">
              <span className={full ? "font-medium text-foreground" : ""}>
                {session.booked}/{session.capacity} {full ? "· completa" : "anotados"}
              </span>
              {session.roleBalance ? ` · ${session.leaders} líd. · ${session.followers} seg.` : ""}
            </p>
          </>
        )}
      </Link>
      {action}
    </div>
  );
}
