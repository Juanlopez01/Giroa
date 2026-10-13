import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Settings2 } from "lucide-react";
import { requireStaff } from "@/lib/panel";
import { can } from "@/lib/gating";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, todayYmd, toYmd } from "@/lib/datetime";
import { monthLabel, parseMonth, shiftMonth } from "@/lib/payouts";
import { loadMonthPayouts } from "@/lib/payouts.server";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { PayPendingButtons } from "../cobrar/charge-form";
import { SmallAction } from "../equipo/team-controls";
import { markPaid, undoPayout } from "./actions";

export const metadata: Metadata = { title: "Liquidación de profes" };

const METHOD_LABELS = { cash: "en efectivo", transfer: "por transferencia", mercadopago: "por Mercado Pago" } as const;

export default async function PayoutsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/liquidaciones">) {
  const { slug } = await params;
  const { studio, isAdmin } = await requireStaff(slug, "/panel/liquidaciones");
  if (!(await can(studio.id, "teacher_payouts"))) return <UpgradeNotice feature="teacher_payouts" what="La liquidación de profes" />;

  const tz = studio.timezone;
  const thisMonth = todayYmd(tz).slice(0, 7);
  const sp = await searchParams;
  const month = parseMonth(sp.mes) ?? thisMonth;
  const { payees, paid } = await loadMonthPayouts(studio.id, month, tz);
  const total = payees.reduce((sum, p) => sum + p.totalCents, 0);
  const pendingTotal = payees.filter((p) => !paid.has(p.key)).reduce((sum, p) => sum + p.totalCents, 0);
  // Pagos de profes que ya no tienen clases en el mes (p. ej. cambiaron las reglas).
  const orphanPaid = [...paid.values()].filter((p) => !payees.some((x) => x.key === p.payeeKey));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">{isAdmin ? "Liquidación de profes" : "Mis liquidaciones"}</h1>
        <p className="text-muted">
          {isAdmin
            ? "Lo que le toca a cada profe por las clases que dio en el mes, según lo que cobra en cada clase."
            : "Lo que te toca por las clases que diste en el mes."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-2">
        <Link href={`/panel/liquidaciones?mes=${shiftMonth(month, -1)}`} aria-label="Mes anterior" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-background">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <p className="font-medium capitalize">{monthLabel(month)}</p>
        {month < thisMonth ? (
          <Link href={`/panel/liquidaciones?mes=${shiftMonth(month, 1)}`} aria-label="Mes siguiente" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-background">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">Total del mes</p>
            <p className="font-serif text-2xl font-semibold tabular-nums">{formatArs(total)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">Falta pagar</p>
            <p className="font-serif text-2xl font-semibold tabular-nums">{formatArs(pendingTotal)}</p>
          </div>
        </div>
      ) : null}

      {month === thisMonth ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">El mes no terminó: se van sumando las clases a medida que se dan.</p>
      ) : null}

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Link href="/panel/liquidaciones/reglas" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-background">
            <Settings2 className="h-4 w-4" aria-hidden /> Qué cobra cada profe
          </Link>
          {payees.length ? (
            <a href={`/panel/liquidaciones/exportar?mes=${month}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-background">
              <Download className="h-4 w-4" aria-hidden /> Exportar CSV
            </a>
          ) : null}
        </div>
      ) : null}

      {payees.length === 0 ? (
        <p className="text-muted">
          {isAdmin ? (
            <>
              No hay nada para liquidar en {monthLabel(month)}. Si todavía no lo hiciste, cargá{" "}
              <Link href="/panel/liquidaciones/reglas" className="font-medium text-brand">
                qué cobra cada profe
              </Link>{" "}
              en cada clase.
            </>
          ) : (
            `No tenés clases para liquidar en ${monthLabel(month)}.`
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {payees.map((p) => {
            const done = paid.get(p.key);
            return (
              <li key={p.key} className="rounded-2xl border border-border bg-surface">
                <details>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
                    <span>
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block text-sm text-muted">
                        {p.classes === 1 ? "1 clase" : `${p.classes} clases`} · {p.students === 1 ? "1 alumno presente" : `${p.students} alumnos presentes`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-serif text-xl font-semibold tabular-nums">{formatArs(done?.amountCents ?? p.totalCents)}</span>
                      {done ? (
                        <span className="text-xs font-medium text-success">Pagado</span>
                      ) : (
                        <span className="text-xs text-muted">Ver detalle</span>
                      )}
                    </span>
                  </summary>
                  <ul className="divide-y divide-border border-t border-border text-sm">
                    {p.lines.map((l) => (
                      <li key={`${l.sessionId}-${l.rule}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span>
                          <span className="block font-medium">{l.title}</span>
                          <span className="block text-muted">
                            {formatDayLabel(toYmd(new Date(l.startsAt), tz))} · {formatTime(l.startsAt, tz)} · {l.present} presentes · {l.rule}
                            {l.kind === "percent" ? ` (generó ${formatArs(l.revenueCents)})` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">{formatArs(l.earnedCents)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
                {isAdmin ? (
                  <div className="space-y-2 border-t border-border px-4 py-3">
                    {done ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-muted">
                          Pagado el {formatDayLabel(toYmd(new Date(done.paidAt), tz)).toLowerCase()} {METHOD_LABELS[done.method]}
                          {done.amountCents !== p.totalCents ? ` · con las reglas de hoy da ${formatArs(p.totalCents)}` : ""}
                        </span>
                        <SmallAction run={undoPayout.bind(null, slug, done.id)} label="Deshacer" confirmText={`¿Deshacer el pago a ${p.name}?`} danger />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Marcar como pagado</p>
                        <PayPendingButtons pay={markPaid.bind(null, slug, month, p.key)} />
                      </>
                    )}
                  </div>
                ) : done ? (
                  <p className="border-t border-border px-4 py-3 text-sm text-muted">
                    Te lo pagaron el {formatDayLabel(toYmd(new Date(done.paidAt), tz)).toLowerCase()} {METHOD_LABELS[done.method]}.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin && orphanPaid.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Otros pagos del mes</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
            {orphanPaid.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  {o.payeeName} · {formatArs(o.amountCents)} {METHOD_LABELS[o.method]}
                </span>
                <SmallAction run={undoPayout.bind(null, slug, o.id)} label="Deshacer" confirmText={`¿Deshacer el pago a ${o.payeeName}?`} danger />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
