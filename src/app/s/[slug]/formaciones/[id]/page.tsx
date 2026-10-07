import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMyStaffRole, getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";
import { fmtYmd } from "@/lib/formations";
import { StudioHeader } from "@/components/studio/studio-header";
import { applyToFormation } from "./actions";
import { ApplyForm } from "./apply-form";

async function load(slug: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const studio = await getStudioBySlug(slug);
  if (!studio) return null;
  const supabase = await createClient();
  const { data: f } = await supabase.from("formations").select("*").eq("id", id).eq("studio_id", studio.id).eq("status", "published").maybeSingle();
  return f ? { studio, f } : null;
}

export async function generateMetadata({ params }: PageProps<"/s/[slug]/formaciones/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const found = await load(slug, id);
  return found ? { title: found.f.title, description: `${found.f.title} en ${found.studio.name}. Postulate online.` } : {};
}

// Página pública de una formación: info, cronograma, aranceles y postulación.
export default async function PublicFormationPage({ params }: PageProps<"/s/[slug]/formaciones/[id]">) {
  const { slug, id } = await params;
  const found = await load(slug, id);
  if (!found) notFound();
  const { studio, f } = found;
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: sessions }, user] = await Promise.all([
    supabase.from("formation_sessions").select("id, title, starts_at, ends_at, teacher_name, online_url").eq("formation_id", f.id).order("starts_at"),
    getCurrentUser(),
  ]);
  const [student, staffRole] = user ? await Promise.all([getMyStudent(studio.id, user.id), getMyStaffRole(studio.id, user.id)]) : [null, null];
  const { data: mine } = student
    ? await supabase.from("formation_enrollments").select("id, status").eq("formation_id", f.id).eq("student_id", student.id).maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-8 px-5 py-8">
        {staffRole ? (
          <Link href={`/panel/formaciones/${f.id}`} className="block rounded-xl bg-brand/10 px-4 py-3 text-sm">
            Estás viendo la página pública. <span className="font-medium">Ir a la formación en el panel →</span>
          </Link>
        ) : null}

        <section className="space-y-3">
          <p className="text-sm font-medium tracking-wide text-brand uppercase">Formación</p>
          <h1 className="font-serif text-3xl font-semibold">{f.title}</h1>
          <p className="text-muted">
            Del {fmtYmd(f.starts_on)} al {fmtYmd(f.ends_on)}
            {f.capacity ? ` · ${f.capacity} lugares` : ""}
          </p>
          {f.description ? <p className="whitespace-pre-line">{f.description}</p> : null}
        </section>

        <section className="space-y-2 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-4">
          <h2 className="font-semibold">Aranceles</h2>
          <ul className="space-y-1 text-sm">
            {f.enrollment_fee_cents ? <li>Matrícula: {formatArs(f.enrollment_fee_cents)}</li> : null}
            {f.installments_count ? (
              <li>
                {f.installments_count} {f.installments_count === 1 ? "cuota" : "cuotas"} de {formatArs(f.installment_cents)}
              </li>
            ) : null}
            {f.full_payment_cents ? <li>O un único pago de {formatArs(f.full_payment_cents)}</li> : null}
            {!f.enrollment_fee_cents && !f.installments_count ? <li>Sin costo.</li> : null}
            {f.min_attendance_pct ? <li className="text-muted">Asistencia mínima para aprobar: {f.min_attendance_pct}%</li> : null}
          </ul>
        </section>

        {sessions?.length ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Cronograma</h2>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-sm text-muted">
                    {formatDayLabel(toYmd(new Date(s.starts_at), tz))} · {formatTime(s.starts_at, tz)} a {formatTime(s.ends_at, tz)}
                    {s.online_url ? " · online" : ""}
                  </p>
                  <p className="font-medium">{s.title}</p>
                  {s.teacher_name ? <p className="text-sm text-muted">{s.teacher_name}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-3">
          {mine ? (
            <Link href={`/app/formaciones/${mine.id}`} className="flex h-12 items-center justify-center rounded-xl bg-brand font-medium text-brand-foreground">
              {mine.status === "applied" ? "Ya te postulaste · ver estado" : "Ver mi formación"}
            </Link>
          ) : !f.enrollment_open ? (
            <p className="rounded-xl bg-border/50 px-4 py-3 font-medium">Las postulaciones están cerradas.</p>
          ) : !user ? (
            <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
              <p className="font-semibold">{f.requires_approval ? "Postulate" : "Inscribite"}</p>
              <p className="text-sm text-muted">Entrá con tu email (sin contraseña) y completá tus datos.</p>
              <Link
                href={`/ingresar?next=${encodeURIComponent(`/formaciones/${f.id}`)}`}
                className="flex h-12 items-center justify-center rounded-xl bg-brand font-medium text-brand-foreground"
              >
                Entrar para {f.requires_approval ? "postularme" : "inscribirme"}
              </Link>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
              <p className="font-semibold">{f.requires_approval ? "Postulate" : "Inscribite"}</p>
              {f.requires_approval ? (
                <p className="text-sm text-muted">El estudio revisa cada postulación. Si te aceptan, te llega un mail para pagar la matrícula.</p>
              ) : null}
              <ApplyForm
                action={applyToFormation.bind(null, slug, f.id)}
                defaults={{ fullName: student?.full_name ?? "", phone: student?.phone ?? "" }}
                requiresApproval={f.requires_approval}
              />
            </div>
          )}
        </section>
      </main>
      <footer className="px-5 py-6 text-center text-xs text-muted">Formaciones con Giroa</footer>
    </div>
  );
}
