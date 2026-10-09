import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { formatArs } from "@/lib/money";
import { formatTime, startOfDay, todayYmd, toYmd } from "@/lib/datetime";
import { INCOME_KIND_LABELS, listIncome, type IncomeKind } from "@/lib/income.server";

export const metadata: Metadata = { title: "Pagos" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const METHOD_LABELS = { cash: "Efectivo", transfer: "Transferencia", mercadopago: "Mercado Pago" } as const;
const KINDS = Object.keys(INCOME_KIND_LABELS) as IncomeKind[];

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Todo lo cobrado en el mes: packs, entradas, gift cards, formaciones y
// audiciones (los mismos números que el Inicio del panel).
export default async function PaymentsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/pagos">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/pagos");
  const tz = studio.timezone;
  const sp = await searchParams;

  const currentMonth = todayYmd(tz).slice(0, 7);
  const month = typeof sp.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : currentMonth;
  const kind = KINDS.find((k) => k === sp.tipo) ?? null;

  const all = await listIncome(studio.id, startOfDay(`${month}-01`, tz), startOfDay(`${shiftMonth(month, 1)}-01`, tz));
  const list = kind ? all.filter((i) => i.kind === kind) : all;
  const total = list.reduce((sum, p) => sum + p.amountCents, 0);
  const byMethod = new Map<string, number>();
  for (const p of list) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountCents);
  const byKind = new Map<IncomeKind, number>();
  for (const p of all) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + p.amountCents);
  const kindsWithIncome = KINDS.filter((k) => byKind.has(k));

  const [y, m] = month.split("-").map(Number) as [number, number];
  const href = (q: { mes?: string; tipo?: IncomeKind | null }) => {
    const params = new URLSearchParams();
    const mes = q.mes ?? month;
    if (mes !== currentMonth) params.set("mes", mes);
    const tipo = q.tipo === undefined ? kind : q.tipo;
    if (tipo) params.set("tipo", tipo);
    const s = params.toString();
    return s ? `/panel/pagos?${s}` : "/panel/pagos";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Pagos</h1>
        <Link
          href="/panel/pagos/nuevo"
          className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground"
        >
          + Registrar pago
        </Link>
      </div>

      <div className="flex items-center justify-between rounded-full border border-border bg-surface p-1">
        <Link href={href({ mes: shiftMonth(month, -1) })} className="flex h-9 w-9 items-center justify-center rounded-full text-sm hover:bg-background">
          ←
        </Link>
        <span className="font-medium capitalize">
          {MONTHS[m - 1]} {y}
        </span>
        {month < currentMonth ? (
          <Link href={href({ mes: shiftMonth(month, 1) })} className="flex h-9 w-9 items-center justify-center rounded-full text-sm hover:bg-background">
            →
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center text-sm text-border">→</span>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 rounded-2xl border border-border bg-surface p-4 md:col-span-1">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">{kind ? INCOME_KIND_LABELS[kind] : "Total cobrado"}</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{formatArs(total)}</p>
          <p className="text-sm text-muted">
            {list.length} {list.length === 1 ? "cobro" : "cobros"}
          </p>
        </div>
        {(["cash", "transfer", "mercadopago"] as const).map((method) => (
          <div key={method} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">{METHOD_LABELS[method]}</p>
            <p className="mt-1 font-serif text-xl font-semibold tabular-nums">{formatArs(byMethod.get(method) ?? 0)}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60" aria-hidden>
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${total ? Math.round(((byMethod.get(method) ?? 0) / total) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      {kindsWithIncome.length > 1 || kind ? (
        <nav aria-label="Tipo de cobro" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0">
          <Link
            href={href({ tipo: null })}
            aria-current={!kind ? "page" : undefined}
            className={`h-8 shrink-0 rounded-full px-3.5 text-sm leading-8 font-medium ${!kind ? "bg-brand text-brand-foreground" : "bg-border/50 text-muted"}`}
          >
            Todo
          </Link>
          {kindsWithIncome.map((k) => (
            <Link
              key={k}
              href={href({ tipo: k })}
              aria-current={kind === k ? "page" : undefined}
              className={`h-8 shrink-0 rounded-full px-3.5 text-sm leading-8 font-medium whitespace-nowrap ${
                kind === k ? "bg-brand text-brand-foreground" : "bg-border/50 text-muted"
              }`}
            >
              {INCOME_KIND_LABELS[k]} · {formatArs(byKind.get(k) ?? 0)}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <a href={`/panel/exportar/pagos?mes=${month}`} download className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-4 font-medium">
          Exportar el mes (Excel)
        </a>
        <a href="/panel/exportar/pagos?mes=todo" download className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-4 font-medium">
          Exportar todo
        </a>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-muted">No hay cobros en este mes.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {list.map((p) => {
            const paidAt = new Date(p.paidAt);
            const day = toYmd(paidAt, tz).split("-").reverse().slice(0, 2).join("/");
            return (
              <li key={`${p.kind}-${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {p.studentId ? (
                      <Link href={`/panel/alumnos/${p.studentId}`} className="hover:underline">
                        {p.who}
                      </Link>
                    ) : (
                      p.who
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {day} {formatTime(paidAt, tz)} · {p.what} · {METHOD_LABELS[p.method]}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{formatArs(p.amountCents)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
