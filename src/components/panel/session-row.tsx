import Link from "next/link";
import type { AgendaSession } from "@/lib/agenda.server";
import { formatTime } from "@/lib/datetime";

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

  return (
    <div className={`flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="w-14 shrink-0 text-center">
        <p className="text-lg font-semibold tabular-nums">{formatTime(session.startsAt, timeZone)}</p>
        <p className="text-xs text-muted tabular-nums">{formatTime(session.endsAt, timeZone)}</p>
      </div>
      <Link href={`/panel/agenda/${session.id}`} className="min-w-0 flex-1">
        <p className={`truncate font-medium ${cancelled ? "line-through" : ""}`}>{session.title}</p>
        <p className="text-sm text-muted">
          {cancelled ? (
            "Cancelada"
          ) : (
            <>
              <span className={full ? "font-medium text-foreground" : ""}>
                {session.booked}/{session.capacity} {full ? "· completa" : "anotados"}
              </span>
              {session.roleBalance ? (
                <span>
                  {" "}
                  · {session.leaders} líd. · {session.followers} seg.
                </span>
              ) : null}
            </>
          )}
        </p>
      </Link>
      {action}
    </div>
  );
}
