import Link from "next/link";
import { ScanLine } from "lucide-react";
import { shortDate, type MyAttendance, type MyBalance, type MyBooking } from "@/lib/student-data.server";
import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";
import { inCheckinWindow, untilLabel, weeklyCounts } from "@/lib/student-home";

/** Tarjeta protagonista: la próxima clase, cuánto falta y el presente a un toque. */
export function NextClassCard({ booking, timeZone, now }: { booking: MyBooking; timeZone: string; now: Date }) {
  const canCheckIn = booking.status === "booked" && !booking.sessionCancelled && inCheckinWindow(booking.startsAt, booking.endsAt, now);
  const day = formatDayLabel(toYmd(new Date(booking.startsAt), timeZone));

  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand p-5 text-brand-foreground">
      {/* El giro de Giroa, de fondo. */}
      <svg viewBox="0 0 140 140" aria-hidden className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 opacity-25">
        <circle cx="70" cy="70" r="34" fill="none" stroke="currentColor" strokeWidth="10" />
        <path d="M14 76 A56 56 0 0 1 96 20" fill="none" stroke="var(--gold, #c8a46b)" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <p className="relative text-xs font-medium tracking-widest uppercase opacity-80">
        Tu próxima clase · {booking.sessionCancelled ? "cancelada" : untilLabel(booking.startsAt, now, timeZone)}
      </p>
      <h2 className="relative mt-1 font-serif text-2xl font-semibold">{booking.title}</h2>
      <p className="relative text-sm opacity-85">
        {day} · {formatTime(booking.startsAt, timeZone)}
        {booking.role ? ` · como ${ROLE_LABELS[booking.role].toLowerCase()}` : ""}
      </p>
      {booking.sessionCancelled ? (
        <p className="relative mt-3 rounded-xl bg-black/15 px-3 py-2 text-sm">El estudio canceló esta clase. Te devolvimos la clase.</p>
      ) : null}
      <div className="relative mt-4 flex gap-2">
        {booking.status === "attended" ? (
          <span className="inline-flex h-11 items-center rounded-full bg-white/15 px-4 text-sm font-medium">Presente ✓</span>
        ) : canCheckIn ? (
          <Link
            href="/app/presente"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-background font-medium text-brand"
          >
            <ScanLine className="h-4 w-4" aria-hidden /> Dar el presente
          </Link>
        ) : null}
        <Link
          href="/app/reservas"
          className="inline-flex h-11 items-center justify-center rounded-full border border-current/30 px-4 text-sm font-medium"
        >
          Mis reservas
        </Link>
      </div>
    </section>
  );
}

/** Anillo de créditos: lo que queda del pack, con el punto dorado del giro. */
export function CreditsCard({
  balances,
  action = { href: "/app/packs", label: "Comprar", empty: "Ver packs", emptyHint: "Comprá un pack para reservar." },
  emptyTitle = "No tenés clases disponibles",
}: {
  balances: MyBalance[];
  /** Qué ofrecer al lado (en el panel: registrar un pago). null = nada. */
  action?: { href: string; label: string; empty: string; emptyHint: string } | null;
  emptyTitle?: string;
}) {
  if (balances.length === 0) {
    return (
      <section className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
        <div>
          <p className="font-semibold">{emptyTitle}</p>
          {action ? <p className="text-sm text-muted">{action.emptyHint}</p> : null}
        </div>
        {action ? (
          <Link href={action.href} className="inline-flex h-10 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground">
            {action.empty}
          </Link>
        ) : null}
      </section>
    );
  }

  const unlimited = balances.some((b) => b.remaining === null);
  const remaining = balances.reduce((s, b) => s + (b.remaining ?? 0), 0);
  const total = balances.reduce((s, b) => s + (b.total ?? 0), 0);
  const pct = unlimited ? 1 : total > 0 ? remaining / total : 0;
  const expiry = balances.find((b) => b.expiresOn)?.expiresOn;
  const name = balances.length === 1 ? balances[0]!.name : `${balances.length} packs`;

  // Anillo: r = 24, la punta (punto dorado) marca dónde termina lo que queda.
  const r = 24;
  const c = 2 * Math.PI * r;
  const angle = pct * 2 * Math.PI - Math.PI / 2;
  const dot = { x: 30 + r * Math.cos(angle), y: 30 + r * Math.sin(angle) };

  return (
    <section className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
      <svg viewBox="0 0 60 60" className="h-16 w-16 shrink-0" aria-hidden>
        <circle cx="30" cy="30" r={r} fill="none" className="stroke-border" strokeWidth="6" />
        {pct > 0 ? (
          <circle
            cx="30"
            cy="30"
            r={r}
            fill="none"
            className="stroke-brand"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${pct * c} ${c}`}
            transform="rotate(-90 30 30)"
          />
        ) : null}
        <circle cx={dot.x} cy={dot.y} r="4" fill="var(--gold, #c8a46b)" />
        <text x="30" y="35" textAnchor="middle" className="fill-foreground font-serif text-[15px] font-semibold">
          {unlimited ? "∞" : remaining}
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-sm text-muted">
          {unlimited ? "Clases libres" : `${remaining} de ${total} ${total === 1 ? "clase" : "clases"}`}
          {expiry ? ` · vence el ${shortDate(expiry)}` : ""}
        </p>
      </div>
      {action ? (
        <Link href={action.href} className="shrink-0 text-sm font-medium text-brand">
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

/** "Este mes viniste 9 veces", con barritas por semana. Sin culpa: si no vino, no aparece. */
export function AttendanceCard({ attendance, today }: { attendance: MyAttendance; today: number }) {
  if (attendance.thisMonth === 0 && attendance.lastMonth === 0) return null;
  const weeks = weeklyCounts(attendance.days);
  const currentWeek = Math.min(4, Math.floor((today - 1) / 7));
  const max = Math.max(1, ...weeks);
  const diff = attendance.thisMonth - attendance.lastMonth;

  return (
    <section className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <p>
          Este mes viniste{" "}
          <span className="font-semibold">
            {attendance.thisMonth} {attendance.thisMonth === 1 ? "vez" : "veces"}
          </span>
        </p>
        <p className="text-sm text-muted">
          {attendance.thisMonth === 0
            ? `El mes pasado viniste ${attendance.lastMonth}. ¡Te esperamos!`
            : diff > 0
              ? `${diff} más que el mes pasado`
              : diff === 0
                ? "Igual que el mes pasado"
                : "¡Seguí así!"}
        </p>
      </div>
      <div className="flex h-8 items-end gap-1" aria-hidden>
        {weeks.slice(0, currentWeek + 1).map((n, i) => (
          <span
            key={i}
            className={`w-1.5 rounded-full ${i === currentWeek ? "bg-brand" : n > 0 ? "bg-[var(--gold,#c8a46b)]" : "bg-border"}`}
            style={{ height: `${Math.max(18, (n / max) * 100)}%` }}
          />
        ))}
      </div>
    </section>
  );
}
