import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMyStaffRole, getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { StudioHeader } from "@/components/studio/studio-header";
import { applyToAudition } from "./actions";
import { AuditionApplyForm } from "./audition-apply-form";

async function load(slug: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const studio = await getStudioBySlug(slug);
  if (!studio) return null;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("auditions")
    .select("*, formations(id, title, starts_on)")
    .eq("id", id)
    .eq("studio_id", studio.id)
    .neq("status", "draft")
    .maybeSingle();
  return a ? { studio, a } : null;
}

export async function generateMetadata({ params }: PageProps<"/s/[slug]/audiciones/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const found = await load(slug, id);
  return found ? { title: found.a.title, description: `Convocatoria de ${found.studio.name}. Inscribite online.` } : {};
}

// Convocatoria pública: info, formulario, video y turno.
export default async function PublicAuditionPage({ params }: PageProps<"/s/[slug]/audiciones/[id]">) {
  const { slug, id } = await params;
  const found = await load(slug, id);
  if (!found) notFound();
  const { studio, a } = found;
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: fields }, { data: slots }, user] = await Promise.all([
    supabase.from("audition_fields").select("id, label, kind, options, required").eq("audition_id", a.id).order("sort"),
    a.uses_slots ? supabase.rpc("audition_slot_availability", { p_audition_id: a.id }) : Promise.resolve({ data: null }),
    getCurrentUser(),
  ]);
  const [student, staffRole] = user ? await Promise.all([getMyStudent(studio.id, user.id), getMyStaffRole(studio.id, user.id)]) : [null, null];
  const { data: mine } = student
    ? await supabase.from("audition_applications").select("id, status").eq("audition_id", a.id).eq("student_id", student.id).maybeSingle()
    : { data: null };

  const now = nowMs();
  const closed = a.status !== "open" || (a.closes_at !== null && new Date(a.closes_at).getTime() <= now);
  const lastDay = a.closes_at ? formatDayLabel(toYmd(new Date(new Date(a.closes_at).getTime() - 1), tz)).toLowerCase() : null;
  const futureSlots = (slots ?? []).filter((s) => new Date(s.starts_at).getTime() > now);

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-8 px-5 py-8">
        {staffRole ? (
          <Link href={`/panel/formaciones/${a.formation_id}/audicion`} className="block rounded-xl bg-brand/10 px-4 py-3 text-sm">
            Estás viendo la página pública. <span className="font-medium">Ir a la audición en el panel →</span>
          </Link>
        ) : null}

        <section className="space-y-3">
          <p className="text-sm font-medium tracking-wide text-brand uppercase">Convocatoria</p>
          <h1 className="font-serif text-3xl font-semibold">{a.title}</h1>
          {a.formations ? (
            <Link href={`/formaciones/${a.formations.id}`} className="block text-muted hover:text-foreground">
              Para ingresar a {a.formations.title} →
            </Link>
          ) : null}
          <ul className="space-y-1 text-sm">
            {a.fee_cents ? <li>Arancel de inscripción: {formatArs(a.fee_cents)}</li> : <li>Inscripción sin costo</li>}
            {lastDay ? <li>Inscripción hasta el {lastDay}</li> : null}
            {a.uses_slots ? <li>Audición presencial con turno</li> : null}
            {a.video_mode === "required" ? <li>Hay que enviar un video</li> : null}
          </ul>
          {a.description ? <p className="whitespace-pre-line">{a.description}</p> : null}
        </section>

        {mine && mine.status !== "cancelled" && mine.status !== "pending_payment" ? (
          <Link href={`/app/audiciones/${mine.id}`} className="flex h-12 items-center justify-center rounded-xl bg-brand font-medium text-brand-foreground">
            Ya te inscribiste · ver mi audición
          </Link>
        ) : closed ? (
          <p className="rounded-xl bg-border/50 px-4 py-3 font-medium">La inscripción está cerrada.</p>
        ) : !user ? (
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">Inscribite</p>
            <p className="text-sm text-muted">Entrá con tu email (sin contraseña) y completá el formulario.</p>
            <Link
              href={`/ingresar?next=${encodeURIComponent(`/audiciones/${a.id}`)}`}
              className="flex h-12 items-center justify-center rounded-xl bg-brand font-medium text-brand-foreground"
            >
              Entrar para inscribirme
            </Link>
          </div>
        ) : (
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">Inscribite</p>
            <AuditionApplyForm
              action={applyToAudition.bind(null, slug, a.id)}
              questions={(fields ?? []).map((q) => ({ id: q.id, label: q.label, kind: q.kind, options: q.options, required: q.required }))}
              videoMode={a.video_mode as "none" | "optional" | "required"}
              feeCents={a.fee_cents}
              slots={
                a.uses_slots
                  ? futureSlots.map((s) => ({
                      id: s.slot_id,
                      day: formatDayLabel(toYmd(new Date(s.starts_at), tz)),
                      label: formatTime(s.starts_at, tz),
                      remaining: s.remaining,
                    }))
                  : null
              }
              defaults={{ fullName: student?.full_name ?? "", phone: student?.phone ?? "" }}
            />
          </section>
        )}
      </main>
      <footer className="px-5 py-6 text-center text-xs text-muted">Audiciones con Giroa</footer>
    </div>
  );
}
