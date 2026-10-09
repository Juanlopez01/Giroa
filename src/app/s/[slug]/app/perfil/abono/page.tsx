import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { confirmMembershipReturn } from "@/lib/mp/memberships";
import { MEMBERSHIP_STATUS_LABELS, nextChargeLabel } from "@/lib/memberships";
import { CancelMembershipButton } from "@/components/student/membership-buttons";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { cancelMyMembership } from "./actions";

export const metadata: Metadata = { title: "Mi abono" };

const BADGE = {
  pending: "bg-border/60 text-muted",
  active: "bg-success/15 text-success",
  past_due: "bg-danger/10 text-danger",
  cancelled: "bg-border/60 text-muted",
} as const;

export default async function MyMembershipPage({ params, searchParams }: PageProps<"/s/[slug]/app/perfil/abono">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app/perfil/abono");
  // Vuelta de MP: se confirma en el momento, sin esperar al webhook.
  await confirmMembershipReturn(studio.id, await searchParams);

  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("student_subscriptions")
    .select("id, name, amount_cents, status, next_charge_at, last_charge_at, last_error, cancelled_at, mp_preapproval_id")
    .eq("studio_id", studio.id)
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });

  // Los pendientes sin débito son intentos que no llegaron a MP: no se muestran.
  const list = (subs ?? []).filter((s) => s.status !== "pending" || s.mp_preapproval_id);
  const waiting = list.some((s) => s.status === "pending");

  return (
    <div className="space-y-6">
      <Link href="/app/perfil" className="inline-flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Perfil
      </Link>
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Mi abono</h1>
        <p className="text-sm text-muted">
          Se cobra solo todos los meses y te carga las clases del mes. Lo que no usás no se acumula.
        </p>
      </div>

      {waiting ? <LiveRefresh everyMs={5000} maxMinutes={5} /> : null}

      {!list.length ? (
        <div className="space-y-3 rounded-3xl border border-border bg-surface p-5">
          <p className="font-medium">No tenés ningún abono.</p>
          <Link href="/app/packs" className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground">
            Ver packs y abonos
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id} className="space-y-3 rounded-3xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted">{formatArs(s.amount_cents)} por mes</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[s.status]}`}>
                  {MEMBERSHIP_STATUS_LABELS[s.status]}
                </span>
              </div>

              {s.status === "pending" ? (
                <p className="text-sm text-muted">Estamos esperando que Mercado Pago confirme el débito. Tarda unos segundos.</p>
              ) : null}
              {s.status === "past_due" ? (
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                  No pudimos cobrar tu abono{s.last_error ? ` (${s.last_error.toLowerCase()})` : ""}. Mercado Pago lo va a
                  reintentar en los próximos días: revisá tu tarjeta en Mercado Pago.
                </p>
              ) : null}
              {s.status === "active" ? (
                <p className="text-sm">{nextChargeLabel(s.next_charge_at, studio.timezone) ?? "El primer cobro está en camino."}</p>
              ) : null}
              {s.status === "cancelled" ? (
                <p className="text-sm text-muted">Lo que ya pagaste sigue valiendo hasta que vence. No se te va a volver a cobrar.</p>
              ) : (
                <CancelMembershipButton
                  cancel={cancelMyMembership.bind(null, slug, s.id)}
                  question="¿Dar de baja el abono? No se te va a volver a cobrar y podés usar las clases que ya pagaste hasta que venzan."
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
