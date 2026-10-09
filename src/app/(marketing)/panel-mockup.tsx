import { formatArs } from "@/lib/money";

// Captura armada del panel del dueño (datos de ejemplo): lo que paga el estudio
// es esto, así que la landing lo muestra junto a la app del alumno.
const FOLLOW_UPS = [
  { initials: "TÁ", name: "Tomás Álvarez", detail: "Su pack vence el jueves" },
  { initials: "MS", name: "Martina Sosa", detail: "Viene pero no tiene saldo" },
  { initials: "CG", name: "Carolina Giménez", detail: "Probó y no compró" },
];
const OCCUPANCY = [
  { title: "Tango inicial · Lun 19:00", pct: 95, hint: "Se llena: conviene abrir otro horario" },
  { title: "Tango intermedio · Mié 20:30", pct: 72, hint: null },
  { title: "Práctica guiada · Vie 22:00", pct: 38, hint: "Poca gente" },
];

export function PanelMockup() {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div aria-hidden className="mx-auto w-full max-w-xl rounded-[28px] border border-border bg-background p-2 shadow-2xl shadow-black/10">
      <div className="overflow-hidden rounded-[22px] border border-border bg-[#fbf8f3]">
        {/* Barra del panel */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[11px] font-semibold text-brand-foreground">T</span>
          <span className="text-xs font-semibold">Tango del Sur</span>
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">Dueña</span>
          <span className="ml-auto text-[10px] text-muted">Panel</span>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[1.15fr_1fr]">
          {/* Clase en vivo */}
          <div className="relative overflow-hidden rounded-2xl bg-brand p-4 pr-24 text-brand-foreground">
            <p className="text-[10px] font-medium tracking-widest uppercase opacity-80">En curso</p>
            <p className="font-serif text-lg font-semibold">Tango intermedio</p>
            <p className="text-[11px] opacity-85">20:30 a 22:00 · 6 líd. · 6 seg.</p>
            <div className="absolute top-3 right-3 h-16 w-16">
              <svg viewBox="0 0 56 56" className="h-16 w-16 -rotate-90">
                <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="5" />
                <circle cx="28" cy="28" r={r} fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(8 / 12) * c} ${c}`} />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="font-serif text-base font-semibold">
                  8<span className="text-[10px] opacity-70">/12</span>
                </span>
                <span className="mt-0.5 text-[8px] tracking-wide uppercase opacity-80">presentes</span>
              </span>
            </div>
            <span className="mt-3 inline-block rounded-full bg-background px-3 py-1 text-[11px] font-medium text-brand">Ver la lista</span>
          </div>

          {/* Números del mes */}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 rounded-2xl border border-border bg-surface p-3">
              <p className="text-[9px] font-medium tracking-widest text-muted uppercase">Cobrado este mes</p>
              <p className="font-serif text-xl font-semibold tabular-nums">{formatArs(41250000)}</p>
              <p className="text-[10px] text-success">▲ {formatArs(6800000)} vs. el mes pasado</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <p className="text-[9px] font-medium tracking-widest text-muted uppercase">Activos</p>
              <p className="font-serif text-lg font-semibold">86</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-border/60">
                <div className="h-full w-[57%] rounded-full bg-brand" />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <p className="text-[9px] font-medium tracking-widest text-muted uppercase">Por vencer</p>
              <p className="font-serif text-lg font-semibold">7</p>
              <p className="text-[9px] text-muted">packs esta semana</p>
            </div>
          </div>

          {/* Para hacer hoy */}
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-xs font-semibold">Para hacer hoy</p>
            <ul className="mt-1 divide-y divide-border">
              {FOLLOW_UPS.map((p) => (
                <li key={p.name} className="flex items-center gap-2 py-1.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand">{p.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium">{p.name}</span>
                    <span className="block truncate text-[10px] text-muted">{p.detail}</span>
                  </span>
                  <span className="rounded-full bg-[#25d366] px-2 py-0.5 text-[9px] font-semibold text-white">WhatsApp</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Ocupación */}
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-xs font-semibold">Ocupación por clase</p>
            <ul className="mt-2 space-y-2">
              {OCCUPANCY.map((o) => (
                <li key={o.title}>
                  <div className="flex justify-between gap-2 text-[10px]">
                    <span className="truncate">{o.title}</span>
                    <span className="font-semibold tabular-nums">{o.pct}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-border/60">
                    <div
                      className={`h-full rounded-full ${o.pct >= 90 ? "bg-[var(--gold)]" : o.pct < 50 ? "bg-muted" : "bg-brand"}`}
                      style={{ width: `${o.pct}%` }}
                    />
                  </div>
                  {o.hint ? <p className="mt-0.5 text-[9px] text-muted">{o.hint}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
