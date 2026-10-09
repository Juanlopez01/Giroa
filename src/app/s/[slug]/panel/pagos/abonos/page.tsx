import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { formatArs } from "@/lib/money";
import { MEMBERSHIP_STATUS_LABELS, nextChargeLabel, type MembershipStatus } from "@/lib/memberships";
import { Avatar } from "@/components/ui/avatar";
import { CancelMembershipButton } from "@/components/student/membership-buttons";
import { cancelStudentMembership } from "./actions";

export const metadata: Metadata = { title: "Abonos" };

const FILTERS: { key: MembershipStatus | "todos"; label: string }[] = [
  { key: "todos", label: "Vigentes" },
  { key: "past_due", label: "Cobro rechazado" },
  { key: "cancelled", label: "Dados de baja" },
];

const BADGE = {
  pending: "bg-border/60 text-muted",
  active: "bg-success/15 text-success",
  past_due: "bg-danger/10 text-danger",
  cancelled: "bg-border/60 text-muted",
} as const;

export default async function MembershipsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/pagos/abonos">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/pagos/abonos");
  const ver = (await searchParams).ver;
  const filter = FILTERS.find((f) => f.key === ver)?.key ?? "todos";

  const supabase = await createClient();
  const [on, { data: subs }] = await Promise.all([
    can(studio.id, "memberships"),
    supabase
      .from("student_subscriptions")
      .select(
        "id, name, amount_cents, status, next_charge_at, last_charge_at, last_error, failed_at, cancelled_at, mp_preapproval_id, students!student_subscriptions_studio_id_student_id_fkey(id, full_name)",
      )
      .eq("studio_id", studio.id)
      .order("created_at", { ascending: false }),
  ]);

  // Los pendientes sin débito son intentos que no llegaron a MP.
  const all = (subs ?? []).filter((s) => s.status !== "pending" || s.mp_preapproval_id);
  const live = all.filter((s) => s.status !== "cancelled");
  const list = filter === "todos" ? live : all.filter((s) => s.status === filter);
  const monthly = live.filter((s) => s.status === "active").reduce((sum, s) => sum + s.amount_cents, 0);
  const failed = live.filter((s) => s.status === "past_due").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/panel/pagos" className="text-sm text-muted hover:text-foreground">
          ← Pagos
        </Link>
        <h1 className="font-serif text-3xl font-semibold">Abonos</h1>
        <p className="text-sm text-muted">
          Alumnos con débito automático mensual. Para ofrecer un abono, marcá un pack como “Abono mensual”.
        </p>
      </div>

      {!on ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          Los abonos mensuales están en el plan Estudio. <Link href="/panel/plan" className="font-medium underline">Ver planes</Link>
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="col-span-2 rounded-2xl border border-border bg-surface p-4 md:col-span-1">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Por mes (al día)</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{formatArs(monthly)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Abonados</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{live.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Rechazados</p>
          <p className={`mt-1 font-serif text-3xl font-semibold tabular-nums ${failed ? "text-danger" : ""}`}>{failed}</p>
        </div>
      </section>

      <nav aria-label="Filtros" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "todos" ? "/panel/pagos/abonos" : `/panel/pagos/abonos?ver=${f.key}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              f.key === filter ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {!list.length ? (
        <p className="text-muted">{filter === "todos" ? "Todavía no hay alumnos abonados." : "No hay abonos en esta lista."}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {list.map((s) => (
            <li key={s.id} className="space-y-2 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={s.students?.full_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <Link href={`/panel/alumnos/${s.students?.id}`} className="block truncate font-medium hover:underline">
                    {s.students?.full_name}
                  </Link>
                  <p className="truncate text-sm text-muted">
                    {s.name} · {formatArs(s.amount_cents)} por mes
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[s.status]}`}>
                  {MEMBERSHIP_STATUS_LABELS[s.status]}
                </span>
              </div>
              <p className="text-sm text-muted">
                {s.status === "past_due"
                  ? `${s.last_error ?? "Cobro rechazado"}. Mercado Pago lo reintenta solo.`
                  : s.status === "cancelled"
                    ? "Lo pagado vale hasta que vence."
                    : (nextChargeLabel(s.next_charge_at, studio.timezone) ?? "Esperando el primer cobro.")}
              </p>
              {s.status !== "cancelled" ? (
                <CancelMembershipButton
                  cancel={cancelStudentMembership.bind(null, slug, s.id)}
                  question={`¿Dar de baja el abono de ${s.students?.full_name}? No se le va a volver a cobrar.`}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
