import type { PublicSession } from "@/lib/public-schedule.server";
import { formatTime } from "@/lib/datetime";
import { balanceHint } from "@/lib/role-balance";

/** Tarjeta de una clase en la grilla pública o de la app del alumno. */
export function SessionCard({
  session,
  timeZone,
  action,
}: {
  session: PublicSession;
  timeZone: string;
  action?: React.ReactNode;
}) {
  const full = session.spotsLeft <= 0;
  const hint = session.roleBalance && !full && !session.cancelled ? balanceHint({ leaders: session.leaders, followers: session.followers, maxDiff: session.maxDiff }) : null;

  return (
    <div className={`flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 ${session.cancelled ? "opacity-60" : ""}`}>
      <div className="w-14 shrink-0 pt-0.5 text-center">
        <p className="text-lg font-semibold tabular-nums">{formatTime(session.startsAt, timeZone)}</p>
        <p className="text-xs text-muted tabular-nums">{formatTime(session.endsAt, timeZone)}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={`font-medium ${session.cancelled ? "line-through" : ""}`}>{session.title}</p>
        <p className="text-sm text-muted">
          {[session.level, session.teacherName].filter(Boolean).join(" · ") || session.disciplineName}
        </p>
        <p className="text-sm">
          {session.cancelled ? (
            <span className="text-muted">Cancelada</span>
          ) : full ? (
            <span className="font-medium text-danger">Completa</span>
          ) : (
            <span className={session.spotsLeft <= 3 ? "font-medium text-brand" : "text-muted"}>
              {session.spotsLeft === 1 ? "Queda 1 lugar" : `Quedan ${session.spotsLeft} lugares`}
            </span>
          )}
          {hint ? <span className="text-muted"> · {hint}</span> : null}
        </p>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
