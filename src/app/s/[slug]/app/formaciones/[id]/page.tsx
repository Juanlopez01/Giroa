import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { confirmMpReturn } from "@/lib/mp/apply-payment";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { CHARGE_KIND_LABEL, fmtYmd } from "@/lib/formations";
import { payFormationCharge, payFullFormation } from "@/app/s/[slug]/formaciones/[id]/actions";
import { PayButton } from "./pay-button";

export const metadata: Metadata = { title: "Mi formación" };

type Progress = { attended: number; held: number; total: number; min_attendance_pct: number; in_debt: boolean };

export default async function MyFormationPage({ params, searchParams }: PageProps<"/s/[slug]/app/formaciones/[id]">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio } = await requireStudent(slug, `/app/formaciones/${id}`);
  await confirmMpReturn(studio.id, await searchParams);
  const tz = studio.timezone;
  const supabase = await createClient();

  // RLS: solo su propia inscripción.
  const { data: e } = await supabase
    .from("formation_enrollments")
    .select("id, status, formation_id, formations(id, title, starts_on, ends_on, full_payment_cents, installments_count, installment_cents)")
    .eq("id", id)
    .maybeSingle();
  if (!e || !e.formations) notFound();
  const f = e.formations;

  const [{ data: charges }, { data: progressData }, { data: sessions }, { data: assessments }, { data: grades }, { data: attendance }] =
    await Promise.all([
      supabase.from("formation_charges").select("id, kind, number, amount_cents, due_on, status, paid_at").eq("enrollment_id", e.id).order("kind").order("number"),
      supabase.rpc("enrollment_progress", { p_enrollment_id: e.id }),
      supabase.from("formation_sessions").select("id, title, starts_at, ends_at, location, online_url, teacher_name").eq("formation_id", f.id).order("starts_at"),
      supabase.from("formation_assessments").select("id, title, kind, due_on").eq("formation_id", f.id).order("created_at"),
      supabase.from("formation_grades").select("assessment_id, grade, passed, feedback").eq("enrollment_id", e.id),
      supabase.from("formation_attendance").select("formation_session_id").eq("enrollment_id", e.id),
    ]);
  const p = progressData as Progress | null;
  const pending = (charges ?? []).filter((c) => c.status === "pending");
  const enrollmentFee = pending.find((c) => c.kind === "enrollment");
  const installmentsPaid = (charges ?? []).some((c) => c.kind === "installment" && c.status === "paid");
  const fullPaid = (charges ?? []).some((c) => c.kind === "full" && c.status === "paid");
  const attendedIds = new Set((attendance ?? []).map((a) => a.formation_session_id));
  const now = nowMs();
  const pct = p && p.held ? Math.round((p.attended / p.held) * 100) : null;
  const label = (c: { kind: "enrollment" | "installment" | "full"; number: number }) =>
    c.kind === "installment" ? `Cuota ${c.number}` : CHARGE_KIND_LABEL[c.kind];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">Formación</p>
        <h1 className="text-2xl font-semibold">{f.title}</h1>
        <p className="text-sm text-muted">
          Del {fmtYmd(f.starts_on)} al {fmtYmd(f.ends_on)}
        </p>
      </div>

      {e.status === "applied" ? (
        <div className="space-y-1 rounded-2xl border border-border bg-surface p-5">
          <p className="font-semibold">Tu postulación está en revisión</p>
          <p className="text-sm text-muted">El estudio la está mirando. Te avisamos por mail cuando haya una respuesta.</p>
        </div>
      ) : e.status === "rejected" ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-semibold">Esta vez no quedaste</p>
          <p className="text-sm text-muted">Gracias por postularte. Podés consultar con el estudio por próximas convocatorias.</p>
        </div>
      ) : e.status === "withdrawn" ? (
        <p className="rounded-2xl border border-border bg-surface p-5">Estás de baja de esta formación.</p>
      ) : e.status === "approved" ? (
        <div className="space-y-3 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-5">
          <p className="font-semibold">¡Quedaste! Asegurá tu lugar</p>
          {enrollmentFee ? (
            <>
              <p className="text-sm text-muted">
                Pagá la matrícula de {formatArs(enrollmentFee.amount_cents)} antes del {fmtYmd(enrollmentFee.due_on)}.
              </p>
              <PayButton pay={payFormationCharge.bind(null, slug, enrollmentFee.id)} label={`Pagar ${formatArs(enrollmentFee.amount_cents)} con Mercado Pago`} />
            </>
          ) : null}
        </div>
      ) : (
        <>
          {p?.in_debt ? (
            <div className="space-y-1 rounded-2xl bg-danger/10 p-5 text-danger">
              <p className="font-semibold">Tenés una cuota vencida</p>
              <p className="text-sm">Hasta que la pagues, el acceso a la formación queda en pausa. Tus clases regulares las seguís reservando.</p>
            </div>
          ) : null}

          {pending.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Pagos</h2>
              {f.full_payment_cents && !installmentsPaid && !fullPaid ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                  <div>
                    <p className="font-medium">Pagá todo junto y ahorrá</p>
                    <p className="text-sm text-muted">
                      {formatArs(f.full_payment_cents)} en vez de {formatArs(f.installment_cents * f.installments_count)}
                    </p>
                  </div>
                  <PayButton pay={payFullFormation.bind(null, slug, e.id)} label="Pagar el total" variant="outline" />
                </div>
              ) : null}
              <ul className="space-y-2">
                {pending.slice(0, 4).map((c) => {
                  const overdue = c.due_on < toYmd(new Date(now), tz);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                      <div>
                        <p className="font-medium">
                          {label(c)} · {formatArs(c.amount_cents)}
                        </p>
                        <p className={`text-sm ${overdue ? "text-danger" : "text-muted"}`}>
                          {overdue ? "Venció" : "Vence"} el {fmtYmd(c.due_on)}
                        </p>
                      </div>
                      <PayButton pay={payFormationCharge.bind(null, slug, c.id)} label="Pagar" />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (charges ?? []).length ? (
            <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">Estás al día con los pagos ✓</p>
          ) : null}

          {!p?.in_debt ? (
            <>
              <section className="space-y-2 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-4">
                <p className="text-sm text-muted">Tu asistencia</p>
                <p className="text-xl font-semibold">
                  {p?.attended ?? 0} de {p?.held ?? 0} encuentros{pct !== null ? ` · ${pct}%` : ""}
                </p>
                <p className="text-sm text-muted">
                  Para aprobar necesitás {p?.min_attendance_pct ?? 0}%.
                  {pct !== null ? (pct >= (p?.min_attendance_pct ?? 0) ? " ¡Vas bien!" : " Ojo, estás por debajo.") : ""}
                </p>
              </section>

              {sessions?.length ? (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">Cronograma</h2>
                  <ul className="space-y-2">
                    {sessions.map((s) => {
                      const past = new Date(s.ends_at).getTime() < now;
                      return (
                        <li key={s.id} className={`rounded-2xl border border-border bg-surface p-4 ${past ? "opacity-70" : ""}`}>
                          <p className="text-sm text-muted">
                            {formatDayLabel(toYmd(new Date(s.starts_at), tz))} · {formatTime(s.starts_at, tz)} a {formatTime(s.ends_at, tz)}
                            {s.location ? ` · ${s.location}` : ""}
                          </p>
                          <p className="font-medium">{s.title}</p>
                          {s.teacher_name ? <p className="text-sm text-muted">{s.teacher_name}</p> : null}
                          {past ? (
                            <p className={`text-sm ${attendedIds.has(s.id) ? "text-success" : "text-muted"}`}>{attendedIds.has(s.id) ? "Presente ✓" : "Ausente"}</p>
                          ) : s.online_url ? (
                            <a href={s.online_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand">
                              Entrar al encuentro online →
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {assessments?.length ? (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">Evaluaciones</h2>
                  <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                    {assessments.map((a) => {
                      const g = (grades ?? []).find((x) => x.assessment_id === a.id);
                      return (
                        <li key={a.id} className="flex items-start justify-between gap-3 p-4">
                          <div>
                            <p className="font-medium">{a.title}</p>
                            {a.due_on ? <p className="text-sm text-muted">Entrega {fmtYmd(a.due_on)}</p> : null}
                            {g?.feedback ? <p className="text-sm">{g.feedback}</p> : null}
                          </div>
                          <span className={`shrink-0 text-sm font-medium ${g ? (g.passed ? "text-success" : "text-danger") : "text-muted"}`}>
                            {!g ? "Pendiente" : a.kind === "grade" ? g.grade : g.passed ? "Aprobado" : "Desaprobado"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </>
      )}

      <Link href="/app" className="block text-sm text-muted">
        ← Volver
      </Link>
    </div>
  );
}
