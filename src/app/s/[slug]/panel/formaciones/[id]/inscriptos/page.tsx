import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { CHARGE_KIND_LABEL, fmtYmd } from "@/lib/formations";
import { whatsappLink } from "@/lib/dashboard.server";
import { decideEnrollment, recordFormationPayment, setGrade, withdrawEnrollment } from "../../actions";
import { ActionButtons, GradeInput } from "./enrollment-controls";

export const metadata: Metadata = { title: "Inscriptos" };

type Progress = { attended: number; held: number; total: number; min_attendance_pct: number; in_debt: boolean };

export default async function EnrollmentsPage({ params }: PageProps<"/s/[slug]/panel/formaciones/[id]/inscriptos">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio, isAdmin, canTakePayments } = await requireStaff(slug, `/panel/formaciones/${id}/inscriptos`);
  const supabase = await createClient();

  const [{ data: f }, { data: enrollments }, { data: charges }, { data: assessments }, { data: grades }] = await Promise.all([
    supabase.from("formations").select("id, title, min_attendance_pct").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase
      .from("formation_enrollments")
      .select("id, status, application_message, applied_at, students!formation_enrollments_studio_id_student_id_fkey(id, full_name, email, phone)")
      .eq("formation_id", id)
      .order("applied_at"),
    supabase.from("formation_charges").select("id, enrollment_id, kind, number, amount_cents, due_on, status").eq("formation_id", id).order("due_on"),
    supabase.from("formation_assessments").select("id, title, kind").eq("formation_id", id).order("created_at"),
    supabase.from("formation_grades").select("assessment_id, enrollment_id, grade, passed"),
  ]);
  if (!f) notFound();

  const enrolled = (enrollments ?? []).filter((e) => e.status === "enrolled");
  const progress = new Map<string, Progress>(
    await Promise.all(
      enrolled.map(async (e) => [e.id, (await supabase.rpc("enrollment_progress", { p_enrollment_id: e.id })).data as Progress] as const),
    ),
  );
  const chargesBy = new Map<string, NonNullable<typeof charges>>();
  for (const c of charges ?? []) chargesBy.set(c.enrollment_id, [...(chargesBy.get(c.enrollment_id) ?? []), c]);
  const gradeOf = (a: string, e: string) => (grades ?? []).find((g) => g.assessment_id === a && g.enrollment_id === e);

  const applied = (enrollments ?? []).filter((e) => e.status === "applied");
  const approved = (enrollments ?? []).filter((e) => e.status === "approved");
  const closed = (enrollments ?? []).filter((e) => e.status === "rejected" || e.status === "withdrawn");
  const inDebt = enrolled.filter((e) => progress.get(e.id)?.in_debt);

  const payButtons = (chargeId: string) =>
    canTakePayments
      ? [
          { label: "Efectivo", run: recordFormationPayment.bind(null, slug, chargeId, "cash") },
          { label: "Transferencia", run: recordFormationPayment.bind(null, slug, chargeId, "transfer") },
        ]
      : [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <Link href={`/panel/formaciones/${f.id}`} className="text-sm text-muted hover:text-foreground">
          ← {f.title}
        </Link>
        <h1 className="text-2xl font-semibold">Inscriptos</h1>
        <p className="text-muted">
          {enrolled.length} {enrolled.length === 1 ? "inscripto" : "inscriptos"}
          {inDebt.length ? ` · ${inDebt.length} con cuota vencida` : ""}
        </p>
      </div>

      {applied.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Por revisar ({applied.length})</h2>
          <ul className="space-y-3">
            {applied.map((e) => (
              <li key={e.id} className="space-y-2 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{e.students?.full_name}</p>
                    <p className="text-sm text-muted">
                      {[e.students?.email, e.students?.phone].filter(Boolean).join(" · ")} · se postuló el{" "}
                      {fmtYmd(e.applied_at.slice(0, 10))}
                    </p>
                  </div>
                  {isAdmin ? (
                    <ActionButtons
                      buttons={[
                        { label: "Aprobar", tone: "primary", run: decideEnrollment.bind(null, slug, e.id, true) },
                        { label: "No admitir", tone: "danger", run: decideEnrollment.bind(null, slug, e.id, false), confirm: "¿No admitir? Le avisamos por mail." },
                      ]}
                    />
                  ) : null}
                </div>
                {e.application_message ? <p className="rounded-xl bg-background p-3 text-sm whitespace-pre-line">{e.application_message}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {approved.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Aprobados, falta la matrícula ({approved.length})</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {approved.map((e) => {
              const fee = chargesBy.get(e.id)?.find((c) => c.kind === "enrollment" && c.status === "pending");
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{e.students?.full_name}</p>
                    <p className="text-sm text-muted">{fee ? `Matrícula ${formatArs(fee.amount_cents)} · le mandamos el link` : ""}</p>
                  </div>
                  {fee ? <ActionButtons buttons={payButtons(fee.id)} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Inscriptos ({enrolled.length})</h2>
        {!enrolled.length ? (
          <p className="text-muted">Todavía no hay inscriptos.</p>
        ) : (
          <ul className="space-y-3">
            {enrolled.map((e) => {
              const p = progress.get(e.id);
              const pct = p && p.held ? Math.round((p.attended / p.held) * 100) : null;
              const pending = (chargesBy.get(e.id) ?? []).filter((c) => c.status === "pending");
              const paidCount = (chargesBy.get(e.id) ?? []).filter((c) => c.status === "paid").length;
              return (
                <li key={e.id} className={`space-y-3 rounded-2xl border bg-surface p-4 ${p?.in_debt ? "border-danger/40" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {e.students?.full_name}
                        {p?.in_debt ? <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">Cuota vencida</span> : null}
                      </p>
                      <p className="text-sm text-muted">
                        Asistencia {p?.attended ?? 0}/{p?.held ?? 0}
                        {pct !== null ? ` (${pct}%` : ""}
                        {pct !== null ? (pct >= f.min_attendance_pct ? " ✓)" : `, necesita ${f.min_attendance_pct}%)`) : ""} · {paidCount}{" "}
                        {paidCount === 1 ? "pago" : "pagos"}
                      </p>
                    </div>
                    <span className="flex items-center gap-3">
                      {p?.in_debt && e.students?.phone ? (
                        <a
                          href={whatsappLink(e.students.phone, `¡Hola ${e.students.full_name.split(" ")[0]}! Te escribimos de ${studio.name}: tenés una cuota de ${f.title} vencida. ¿Te paso el link para pagarla?`) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#128c7e]"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                      {isAdmin ? (
                        <ActionButtons buttons={[{ label: "Dar de baja", tone: "danger", run: withdrawEnrollment.bind(null, slug, e.id), confirm: "¿Dar de baja? Las cuotas pendientes quedan sin efecto." }]} />
                      ) : null}
                    </span>
                  </div>
                  {pending.length ? (
                    <ul className="space-y-2">
                      {pending.slice(0, 3).map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-sm">
                          <span>
                            {c.kind === "installment" ? `Cuota ${c.number}` : CHARGE_KIND_LABEL[c.kind]} · {formatArs(c.amount_cents)} · vence{" "}
                            {fmtYmd(c.due_on)}
                          </span>
                          <ActionButtons buttons={payButtons(c.id)} />
                        </li>
                      ))}
                      {pending.length > 3 ? <li className="text-xs text-muted">y {pending.length - 3} cuotas más</li> : null}
                    </ul>
                  ) : null}
                  {assessments?.length ? (
                    <div className="space-y-1.5 border-t border-border pt-3">
                      {assessments.map((a) => {
                        const g = gradeOf(a.id, e.id);
                        return (
                          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="text-muted">{a.title}</span>
                            <GradeInput
                              kind={a.kind}
                              initial={{ grade: g?.grade ?? null, passed: g?.passed ?? null }}
                              save={setGrade.bind(null, slug, a.id, e.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {closed.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted">No admitidos y bajas ({closed.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {closed.map((e) => (
              <li key={e.id}>
                {e.students?.full_name} · {e.status === "rejected" ? "no admitido/a" : "de baja"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
