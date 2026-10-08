import Link from "next/link";

/** El giro de Giroa: el anillo con el arco dorado da una vuelta y aparece el ✓. */
export function GiroMark({ className = "h-28 w-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" className={className} aria-hidden="true">
      <circle cx="70" cy="70" r="40" fill="none" className="stroke-brand" strokeWidth="10" opacity="0.15" />
      <g className="origin-center motion-safe:animate-giro" style={{ transformBox: "view-box" }}>
        <circle cx="70" cy="70" r="40" fill="none" className="stroke-brand" strokeWidth="10" />
        <path
          d="M12 76 A58 58 0 0 1 98 19"
          fill="none"
          stroke="var(--gold, #c8a46b)"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M52 71 l12 12 l24 -26"
        fill="none"
        className="stroke-brand origin-center motion-safe:animate-pop"
        style={{ transformBox: "view-box" }}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PresenceSuccess({
  title,
  when,
  already,
  formation,
}: {
  title: string;
  when: string;
  already: boolean;
  formation: boolean;
}) {
  return (
    <div className="flex flex-col items-center space-y-5 pt-6 text-center">
      <GiroMark />
      <div className="space-y-1">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">{already ? "Ya tenías el presente" : "¡Presente!"}</p>
        <h1 className="font-serif text-3xl font-semibold">{title}</h1>
        <p className="text-muted">{when}</p>
      </div>
      <p className="max-w-xs text-sm text-muted">
        {formation ? "Quedó registrada tu asistencia al encuentro." : "Quedó registrada tu asistencia. ¡Buena clase!"}
      </p>
      <Link href="/app" className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-medium text-brand-foreground">
        Ir al inicio
      </Link>
    </div>
  );
}
