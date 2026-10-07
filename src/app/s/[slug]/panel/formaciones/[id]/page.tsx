import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { centsToInput, formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, todayYmd, toYmd } from "@/lib/datetime";
import { studioUrl } from "@/lib/urls";
import { FormMessage } from "@/components/ui/field";
import { CopyLink } from "../../eventos/[id]/controls";
import { SmallAction } from "../../equipo/team-controls";
import { addAssessment, addFormationSession, removeFormationSession, setFormationStatus, updateFormation } from "../actions";
import { FormationForm } from "../formation-form";
import { AssessmentForm, SessionForm } from "./controls";

export const metadata: Metadata = { title: "Formación" };

const fmt = (ymd: string) => ymd.split("-").reverse().map(Number).join("/");

export default async function FormationPage({ params, searchParams }: PageProps<"/s/[slug]/panel/formaciones/[id]">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const created = (await searchParams).nueva === "1";
  const { studio, isAdmin } = await requireStaff(slug, `/panel/formaciones/${id}`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: f }, { data: sessions }, { data: assessments }, { data: enrollments }] = await Promise.all([
    supabase.from("formations").select("*").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase.from("formation_sessions").select("*").eq("formation_id", id).order("starts_at"),
    supabase.from("formation_assessments").select("*").eq("formation_id", id).order("created_at"),
    supabase.from("formation_enrollments").select("status").eq("formation_id", id),
  ]);
  if (!f) notFound();

  const applied = (enrollments ?? []).filter((e) => e.status === "applied").length;
  const enrolled = (enrollments ?? []).filter((e) => e.status === "enrolled").length;
  const approved = (enrollments ?? []).filter((e) => e.status === "approved").length;
  const publicUrl = studioUrl(slug, `/formaciones/${f.id}`);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link href="/panel/formaciones" className="text-sm text-muted hover:text-foreground">
          ← Formaciones
        </Link>
        <h1 className="text-2xl font-semibold">{f.title}</h1>
        <p className="text-muted">
          {fmt(f.starts_on)} al {fmt(f.ends_on)}
          {f.capacity ? ` · cupo ${f.capacity}` : ""}
        </p>
        <p className="text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.status === "published" ? "bg-success/10 text-success" : "bg-border text-muted"}`}
          >
            {f.status === "published" ? (f.enrollment_open ? "Publicada · postulaciones abiertas" : "Publicada · postulaciones cerradas") : f.status === "draft" ? "Borrador" : "Archivada"}
          </span>
        </p>
      </div>

      {created ? <FormMessage ok message="¡Formación creada! Agregale los encuentros y publicala." /> : null}

      <Link
        href={`/panel/formaciones/${f.id}/inscriptos`}
        className="flex items-center justify-between gap-4 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-4 transition hover:border-foreground hover:border-l-brand"
      >
        <span>
          <span className="block font-semibold">Inscriptos y postulaciones</span>
          <span className="block text-sm text-muted">
            {enrolled} {enrolled === 1 ? "inscripto" : "inscriptos"}
            {approved ? ` · ${approved} por pagar la matrícula` : ""}
            {applied ? ` · ${applied} por revisar` : ""}
          </span>
        </span>
        <span className="shrink-0 font-medium text-brand">Ver →</span>
      </Link>

      {isAdmin ? (
        <Link
          href={`/panel/formaciones/${f.id}/audicion`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-foreground"
        >
          <span>
            <span className="block font-semibold">Audición</span>
            <span className="block text-sm text-muted">Convocatoria, formulario, turnos y resultados.</span>
          </span>
          <span className="shrink-0 font-medium text-brand">Configurar →</span>
        </Link>
      ) : null}

      {f.status === "published" ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Link para compartir</h2>
          <CopyLink url={publicUrl} />
        </section>
      ) : null}

      {isAdmin ? (
        <div className="flex flex-wrap gap-4">
          {f.status !== "published" ? (
            <SmallAction run={setFormationStatus.bind(null, slug, f.id, { status: "published" })} label="Publicar formación" />
          ) : (
            <SmallAction
              run={setFormationStatus.bind(null, slug, f.id, { enrollment_open: !f.enrollment_open })}
              label={f.enrollment_open ? "Cerrar postulaciones" : "Abrir postulaciones"}
            />
          )}
          {f.status !== "archived" ? (
            <SmallAction
              run={setFormationStatus.bind(null, slug, f.id, { status: "archived" })}
              label="Archivar"
              danger
              confirmText="¿Archivar la formación? Deja de verse y de recibir postulaciones. Los inscriptos y sus cuotas siguen."
            />
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Encuentros</h2>
        {!sessions?.length ? (
          <p className="text-muted">Todavía no hay encuentros. Agregá el cronograma.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-4">
                <Link href={`/panel/formaciones/${f.id}/encuentros/${s.id}`} className="min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted">
                    {formatDayLabel(toYmd(new Date(s.starts_at), tz))} · {formatTime(s.starts_at, tz)} a {formatTime(s.ends_at, tz)}
                    {s.teacher_name ? ` · ${s.teacher_name}` : ""}
                    {s.location ? ` · ${s.location}` : ""}
                    {s.online_url ? " · online" : ""}
                  </p>
                  <p className="text-sm font-medium text-brand">Tomar asistencia →</p>
                </Link>
                {isAdmin ? (
                  <SmallAction run={removeFormationSession.bind(null, slug, s.id)} label="Borrar" danger confirmText="¿Borrar este encuentro? Se pierde su asistencia." />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {isAdmin ? (
          <details className="rounded-2xl border border-dashed border-border p-4" open={!sessions?.length}>
            <summary className="cursor-pointer font-medium">+ Agregar encuentro</summary>
            <div className="mt-4">
              <SessionForm action={addFormationSession.bind(null, slug, f.id)} minDate={todayYmd(tz)} />
            </div>
          </details>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Evaluaciones</h2>
        {assessments?.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {assessments.map((a) => (
              <li key={a.id} className="p-4">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted">
                  {a.kind === "grade" ? "Nota del 1 al 10" : "Aprobado / desaprobado"}
                  {a.due_on ? ` · entrega ${fmt(a.due_on)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Sin evaluaciones. Son opcionales.</p>
        )}
        {isAdmin ? (
          <details className="rounded-2xl border border-dashed border-border p-4">
            <summary className="cursor-pointer font-medium">+ Agregar evaluación</summary>
            <div className="mt-4">
              <AssessmentForm action={addAssessment.bind(null, slug, f.id)} />
            </div>
          </details>
        ) : null}
      </section>

      {isAdmin ? (
        <details className="border-t border-border pt-6">
          <summary className="cursor-pointer text-lg font-semibold">Datos y aranceles</summary>
          <p className="mt-2 text-sm text-muted">
            Matrícula {formatArs(f.enrollment_fee_cents)}
            {f.installments_count ? ` · ${f.installments_count} cuotas de ${formatArs(f.installment_cents)}` : " · sin cuotas"}
            {f.full_payment_cents ? ` · total con descuento ${formatArs(f.full_payment_cents)}` : ""}
          </p>
          <div className="mt-4">
            <FormationForm
              action={updateFormation.bind(null, slug, f.id)}
              submitLabel="Guardar cambios"
              initial={{
                title: f.title,
                description: f.description ?? "",
                startsOn: f.starts_on,
                endsOn: f.ends_on,
                capacity: f.capacity ? String(f.capacity) : "",
                requiresApproval: f.requires_approval,
                enrollmentFee: f.enrollment_fee_cents ? centsToInput(f.enrollment_fee_cents) : "0",
                installmentsCount: f.installments_count,
                installment: f.installment_cents ? centsToInput(f.installment_cents) : "",
                firstDueOn: f.first_due_on ?? "",
                fullPayment: f.full_payment_cents ? centsToInput(f.full_payment_cents) : "",
                minAttendance: f.min_attendance_pct,
              }}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
