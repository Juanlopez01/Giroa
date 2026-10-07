import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { AUDITION_STATUS_LABEL } from "@/lib/formations";
import { ActionButtons } from "../../inscriptos/enrollment-controls";
import { cancelAuditionApplication, recordAuditionPayment, setAuditionResult } from "../actions";

export const metadata: Metadata = { title: "Aspirantes" };

const ORDER = ["submitted", "waitlisted", "pending_payment", "admitted", "rejected"] as const;
const TITLES = {
  submitted: "Por decidir",
  waitlisted: "Lista de espera",
  pending_payment: "Falta el arancel",
  admitted: "Admitidos",
  rejected: "No admitidos",
} as const;

export default async function ApplicantsPage({ params }: PageProps<"/s/[slug]/panel/formaciones/[id]/audicion/aspirantes">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio, canTakePayments } = await requireAdmin(slug, `/panel/formaciones/${id}/audicion/aspirantes`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const { data: audition } = await supabase
    .from("auditions")
    .select("id, title, fee_cents, formation_id, formations(title)")
    .eq("formation_id", id)
    .eq("studio_id", studio.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!audition) notFound();

  const [{ data: apps }, { data: fields }, { data: slots }] = await Promise.all([
    supabase
      .from("audition_applications")
      .select("id, status, answers, video_url, slot_id, fee_cents, paid_at, hold_expires_at, created_at, students!audition_applications_studio_id_student_id_fkey(full_name, email, phone)")
      .eq("audition_id", audition.id)
      .neq("status", "cancelled")
      .order("created_at"),
    supabase.from("audition_fields").select("id, label").eq("audition_id", audition.id).order("sort"),
    supabase.from("audition_slots").select("id, starts_at").eq("audition_id", audition.id),
  ]);
  const slotAt = new Map((slots ?? []).map((s) => [s.id, s.starts_at]));
  const now = nowMs();
  // Las reservas vencidas sin pagar no suman.
  const visible = (apps ?? []).filter((a) => a.status !== "pending_payment" || (a.hold_expires_at && new Date(a.hold_expires_at).getTime() > now) || a.paid_at);
  const sortBySlot = (x: (typeof visible)[number], y: (typeof visible)[number]) =>
    (slotAt.get(x.slot_id ?? "") ?? x.created_at).localeCompare(slotAt.get(y.slot_id ?? "") ?? y.created_at);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <Link href={`/panel/formaciones/${id}/audicion`} className="text-sm text-muted hover:text-foreground">
          ← {audition.title}
        </Link>
        <h1 className="text-2xl font-semibold">Aspirantes</h1>
        <p className="text-muted">
          {visible.length} {visible.length === 1 ? "inscripto" : "inscriptos"}. Al admitir, pasa a la formación y le llega el link de la
          matrícula.
        </p>
      </div>

      {!visible.length ? <p className="text-muted">Todavía no se inscribió nadie.</p> : null}

      {ORDER.map((status) => {
        const list = visible.filter((a) => a.status === status).sort(sortBySlot);
        if (!list.length) return null;
        return (
          <section key={status} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {TITLES[status]} ({list.length})
            </h2>
            <ul className="space-y-3">
              {list.map((a) => {
                const answers = (a.answers ?? {}) as Record<string, string>;
                const slot = a.slot_id ? slotAt.get(a.slot_id) : null;
                return (
                  <li key={a.id} className={`space-y-3 rounded-2xl border border-border bg-surface p-4 ${status === "submitted" ? "border-l-4 border-l-brand" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{a.students?.full_name}</p>
                        <p className="text-sm text-muted">{[a.students?.email, a.students?.phone].filter(Boolean).join(" · ")}</p>
                        <p className="text-sm">
                          {slot ? `Turno: ${formatDayLabel(toYmd(new Date(slot), tz))} ${formatTime(slot, tz)}` : ""}
                          {a.fee_cents ? `${slot ? " · " : ""}Arancel ${a.paid_at ? "pagado ✓" : `pendiente (${formatArs(a.fee_cents)})`}` : ""}
                        </p>
                      </div>
                      {status === "submitted" || status === "waitlisted" ? (
                        <ActionButtons
                          buttons={[
                            { label: "Admitir", tone: "primary", run: setAuditionResult.bind(null, slug, a.id, "admitted") },
                            ...(status === "submitted" ? [{ label: "Lista de espera", run: setAuditionResult.bind(null, slug, a.id, "waitlisted") }] : []),
                            { label: "No admitir", tone: "danger" as const, run: setAuditionResult.bind(null, slug, a.id, "rejected"), confirm: "¿No admitir? Le avisamos por mail." },
                          ]}
                        />
                      ) : status === "pending_payment" ? (
                        <ActionButtons
                          buttons={[
                            ...(canTakePayments
                              ? [
                                  { label: "Pagó en efectivo", run: recordAuditionPayment.bind(null, slug, a.id, "cash") },
                                  { label: "Pagó por transferencia", run: recordAuditionPayment.bind(null, slug, a.id, "transfer") },
                                ]
                              : []),
                            { label: "Cancelar", tone: "danger" as const, run: cancelAuditionApplication.bind(null, slug, a.id), confirm: "¿Cancelar la inscripción? Se libera el turno." },
                          ]}
                        />
                      ) : (
                        <span className="text-sm font-medium text-muted">{AUDITION_STATUS_LABEL[status]}</span>
                      )}
                    </div>
                    {(fields ?? []).some((q) => answers[q.id]) || a.video_url ? (
                      <dl className="space-y-1.5 rounded-xl bg-background p-3 text-sm">
                        {(fields ?? []).map((q) =>
                          answers[q.id] ? (
                            <div key={q.id}>
                              <dt className="text-muted">{q.label}</dt>
                              <dd className="whitespace-pre-line">{answers[q.id]}</dd>
                            </div>
                          ) : null,
                        )}
                        {a.video_url ? (
                          <div>
                            <dt className="text-muted">Video</dt>
                            <dd>
                              <a href={a.video_url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">
                                Ver video →
                              </a>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
