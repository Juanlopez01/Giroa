import Link from "next/link";
import { QrCode } from "lucide-react";
import type { AgendaSession } from "@/lib/agenda.server";
import { formatTime } from "@/lib/datetime";
import { untilLabel } from "@/lib/student-home";

/**
 * La clase en curso (o la próxima de hoy) con los presentes en vivo: ahora que
 * los alumnos se dan el presente solos, el profe ve quién va llegando.
 */
export function LiveClassCard({ session, timeZone, now }: { session: AgendaSession; timeZone: string; now: Date }) {
  const started = new Date(session.startsAt).getTime() <= now.getTime();
  const total = Math.max(session.booked, 1);
  const pct = started ? session.attended / total : session.booked / Math.max(session.capacity, 1);
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand p-5 text-brand-foreground">
      <svg viewBox="0 0 140 140" aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 opacity-20">
        <circle cx="70" cy="70" r="34" fill="none" stroke="currentColor" strokeWidth="10" />
        <path d="M14 76 A56 56 0 0 1 96 20" fill="none" stroke="var(--gold, #c8a46b)" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <div className="relative flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-widest uppercase opacity-80">
            {started ? "En curso" : `Próxima clase · ${untilLabel(session.startsAt, now, timeZone)}`}
          </p>
          <h2 className="mt-1 truncate font-serif text-2xl font-semibold">{session.title}</h2>
          <p className="text-sm opacity-85">
            {formatTime(session.startsAt, timeZone)} a {formatTime(session.endsAt, timeZone)}
            {session.roleBalance ? ` · ${session.leaders} líd. · ${session.followers} seg.` : ""}
          </p>
        </div>
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="6" />
            {pct > 0 ? (
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="var(--gold, #c8a46b)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(1, pct) * c} ${c}`}
              />
            ) : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="font-serif text-xl font-semibold tabular-nums">
              {started ? session.attended : session.booked}
              <span className="text-sm opacity-70">/{started ? session.booked : session.capacity}</span>
            </span>
            <span className="mt-1 text-[10px] tracking-wide uppercase opacity-80">{started ? "presentes" : "anotados"}</span>
          </div>
        </div>
      </div>
      <div className="relative mt-4 flex gap-2">
        <Link
          href={`/panel/agenda/${session.id}`}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-background font-medium text-brand"
        >
          Ver la lista
        </Link>
        <Link
          href="/panel/ajustes/qr"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-current/30 px-4 text-sm font-medium"
        >
          <QrCode className="h-4 w-4" aria-hidden /> Cartel QR
        </Link>
      </div>
    </section>
  );
}
