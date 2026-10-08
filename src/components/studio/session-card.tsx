import type { PublicSession } from "@/lib/public-schedule.server";
import { formatTime } from "@/lib/datetime";
import { balanceHint } from "@/lib/role-balance";

/** Lugares: "Quedan 3" en ámbar cuando queda poco, "Completa" en gris. */
function SpotsChip({ session }: { session: PublicSession }) {
  if (session.cancelled) return <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-xs font-medium text-muted">Cancelada</span>;
  if (session.spotsLeft <= 0) return <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-xs font-medium text-muted">Completa</span>;
  if (session.spotsLeft <= 3)
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-amber-900">
        {session.spotsLeft === 1 ? "Queda 1" : `Quedan ${session.spotsLeft}`}
      </span>
    );
  return <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-brand">{session.spotsLeft} lugares</span>;
}

/** Danzas en pareja: cuántos líderes y seguidores hay, y qué rol falta. */
function RoleBar({ session }: { session: PublicSession }) {
  const total = session.leaders + session.followers;
  const hint = session.spotsLeft > 0 ? balanceHint({ leaders: session.leaders, followers: session.followers, maxDiff: session.maxDiff }) : null;
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-border/60" aria-hidden>
        {total > 0 ? (
          <>
            <span className="bg-brand" style={{ flexGrow: session.leaders }} />
            <span className="bg-[var(--gold,#c8a46b)]" style={{ flexGrow: session.followers }} />
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        {session.leaders} {session.leaders === 1 ? "líder" : "líderes"} · {session.followers}{" "}
        {session.followers === 1 ? "seguidor/a" : "seguidores/as"}
        {hint ? <span className="font-medium text-foreground"> · {hint.toLowerCase()}</span> : null}
      </p>
    </div>
  );
}

/**
 * Una clase en la grilla (página pública y app del alumno): la hora grande a la
 * izquierda, la tarjeta con lugares, profe y balance de roles, y la acción abajo.
 */
export function SessionCard({
  session,
  timeZone,
  action,
  booked = false,
}: {
  session: PublicSession;
  timeZone: string;
  action?: React.ReactNode;
  booked?: boolean;
}) {
  const minutes = Math.round((new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60_000);
  const meta = [`${minutes} min`, session.level, session.teacherName].filter(Boolean).join(" · ");

  return (
    <div className={`flex gap-3 ${session.cancelled ? "opacity-60" : ""}`}>
      <div className="w-12 shrink-0 pt-4 text-center">
        <p className="font-semibold tabular-nums">{formatTime(session.startsAt, timeZone)}</p>
      </div>
      <div
        className={`min-w-0 flex-1 space-y-3 rounded-2xl border bg-surface p-4 ${
          booked ? "border-brand/40 shadow-[inset_3px_0_0_var(--brand)]" : "border-border"
        }`}
      >
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-semibold ${session.cancelled ? "line-through" : ""}`}>{session.title}</p>
            {booked ? (
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-success">Reservada ✓</span>
            ) : (
              <SpotsChip session={session} />
            )}
          </div>
          <p className="text-sm text-muted">{meta || session.disciplineName}</p>
        </div>
        {session.roleBalance && !session.cancelled ? <RoleBar session={session} /> : null}
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
