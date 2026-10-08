import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { formatTime, startOfDay, todayYmd, toYmd } from "@/lib/datetime";

export const metadata: Metadata = { title: "Pagos" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const METHOD_LABELS = { cash: "Efectivo", transfer: "Transferencia", mercadopago: "Mercado Pago" } as const;

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PaymentsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/pagos">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/pagos");
  const tz = studio.timezone;

  const currentMonth = todayYmd(tz).slice(0, 7);
  const mesParam = (await searchParams).mes;
  const month = typeof mesParam === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : currentMonth;
  const from = startOfDay(`${month}-01`, tz);
  const to = startOfDay(`${shiftMonth(month, 1)}-01`, tz);

  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, amount_cents, method, paid_at, notes, students!payments_studio_id_student_id_fkey(id, full_name), pack_products(name)",
    )
    .eq("studio_id", studio.id)
    .eq("status", "approved")
    .gte("paid_at", from.toISOString())
    .lt("paid_at", to.toISOString())
    .order("paid_at", { ascending: false });

  const list = payments ?? [];
  const total = list.reduce((sum, p) => sum + p.amount_cents, 0);
  const byMethod = new Map<string, number>();
  for (const p of list) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_cents);

  const [y, m] = month.split("-").map(Number) as [number, number];

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
        <Link href={`/panel/pagos?mes=${shiftMonth(month, -1)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-sm hover:bg-background">
          ←
        </Link>
        <span className="font-medium capitalize">
          {MONTHS[m - 1]} {y}
        </span>
        {month < currentMonth ? (
          <Link href={`/panel/pagos?mes=${shiftMonth(month, 1)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-sm hover:bg-background">
            →
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center text-sm text-border">→</span>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 rounded-2xl border border-border bg-surface p-4 md:col-span-1">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Total cobrado</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{formatArs(total)}</p>
          <p className="text-sm text-muted">
            {list.length} {list.length === 1 ? "pago" : "pagos"}
          </p>
        </div>
        {(["cash", "transfer", "mercadopago"] as const).map((method) => (
          <div key={method} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">{METHOD_LABELS[method]}</p>
            <p className="mt-1 font-serif text-xl font-semibold tabular-nums">{formatArs(byMethod.get(method) ?? 0)}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60" aria-hidden>
              <div className="h-full rounded-full bg-brand" style={{ width: `${total ? Math.round(((byMethod.get(method) ?? 0) / total) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </section>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-muted">No hay pagos registrados en este mes.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {list.map((p) => {
            const paidAt = p.paid_at ? new Date(p.paid_at) : null;
            const day = paidAt ? toYmd(paidAt, tz).split("-").reverse().slice(0, 2).join("/") : "";
            return (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {p.students ? (
                      <Link href={`/panel/alumnos/${p.students.id}`} className="hover:underline">
                        {p.students.full_name}
                      </Link>
                    ) : (
                      "Alumno"
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {day} {paidAt ? formatTime(paidAt, tz) : ""} · {p.pack_products?.name ?? "Pack"} ·{" "}
                    {METHOD_LABELS[p.method]}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{formatArs(p.amount_cents)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
