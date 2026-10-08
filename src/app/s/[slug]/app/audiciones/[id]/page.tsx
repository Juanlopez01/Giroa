import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { confirmMpReturn } from "@/lib/mp/apply-payment";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";
import { AutoRefresh } from "../../../entradas/[token]/auto-refresh";

export const metadata: Metadata = { title: "Mi audición" };

export default async function MyAuditionPage({ params, searchParams }: PageProps<"/s/[slug]/app/audiciones/[id]">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const estado = sp.estado;
  const { studio } = await requireStudent(slug, `/app/audiciones/${id}`);
  await confirmMpReturn(studio.id, sp);
  const tz = studio.timezone;
  const supabase = await createClient();

  // RLS: solo su propia inscripción.
  const { data: app } = await supabase
    .from("audition_applications")
    .select("id, status, slot_id, fee_cents, paid_at, video_url, audition_id, formation_id, auditions(title)")
    .eq("id", id)
    .maybeSingle();
  if (!app) notFound();

  const [{ data: slot }, { data: enrollment }] = await Promise.all([
    app.slot_id ? supabase.from("audition_slots").select("starts_at").eq("id", app.slot_id).maybeSingle() : Promise.resolve({ data: null }),
    app.status === "admitted"
      ? supabase.from("formation_enrollments").select("id").eq("formation_id", app.formation_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">Audición</p>
        <h1 className="text-2xl font-semibold">{app.auditions?.title}</h1>
      </div>

      {app.status === "pending_payment" ? (
        estado === "rechazado" ? (
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">El pago no se pudo hacer</p>
            <p className="text-sm text-muted">No se cobró nada. Volvé a la convocatoria para intentarlo de nuevo.</p>
            <Link href={`/audiciones/${app.audition_id}`} className="font-medium text-brand">
              Volver a la convocatoria →
            </Link>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">Estamos confirmando el pago del arancel…</p>
            <p className="text-sm text-muted">Apenas Mercado Pago lo apruebe, tu inscripción queda confirmada.</p>
            <AutoRefresh />
          </div>
        )
      ) : app.status === "submitted" ? (
        <div className="space-y-1 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-5">
          <p className="font-semibold">¡Estás inscripto/a!</p>
          <p className="text-sm text-muted">Cuando el estudio tenga los resultados, te avisamos por mail.</p>
        </div>
      ) : app.status === "admitted" ? (
        <div className="space-y-3 rounded-2xl bg-success/10 p-5 text-success">
          <p className="font-semibold">¡Quedaste! 🎉</p>
          <p className="text-sm">Te admitieron en la formación. Asegurá tu lugar pagando la matrícula.</p>
          {enrollment ? (
            <Link href={`/app/formaciones/${enrollment.id}`} className="inline-flex h-11 items-center rounded-xl bg-brand px-4 font-medium text-brand-foreground">
              Ir a mi formación
            </Link>
          ) : null}
        </div>
      ) : app.status === "waitlisted" ? (
        <div className="space-y-1 rounded-2xl border border-border bg-surface p-5">
          <p className="font-semibold">Estás en lista de espera</p>
          <p className="text-sm text-muted">Si se libera un lugar, el estudio te avisa.</p>
        </div>
      ) : app.status === "rejected" ? (
        <div className="space-y-1 rounded-2xl border border-border bg-surface p-5">
          <p className="font-semibold">Esta vez no quedaste</p>
          <p className="text-sm text-muted">Gracias por audicionar. Consultá con el estudio por próximas convocatorias.</p>
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-5">Esta inscripción fue cancelada.</p>
      )}

      <section className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
        {slot ? (
          <p>
            <span className="text-muted">Tu turno: </span>
            <span className="font-medium">
              {formatDayLabel(toYmd(new Date(slot.starts_at), tz))} a las {formatTime(slot.starts_at, tz)}
            </span>
          </p>
        ) : null}
        {app.fee_cents ? (
          <p>
            <span className="text-muted">Arancel: </span>
            {formatArs(app.fee_cents)} · {app.paid_at ? "pagado ✓" : "pendiente"}
          </p>
        ) : null}
        {app.video_url ? (
          <p>
            <span className="text-muted">Video: </span>
            <a href={app.video_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">
              ver
            </a>
          </p>
        ) : null}
      </section>

      <Link href="/app" className="block text-sm text-muted">
        ← Volver
      </Link>
    </div>
  );
}
