import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { centsToInput } from "@/lib/money";
import { formatDayLabel, formatTime, todayYmd, toYmd } from "@/lib/datetime";
import { studioUrl } from "@/lib/urls";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { CopyLink } from "../../../eventos/[id]/controls";
import { SmallAction } from "../../../equipo/team-controls";
import { addAuditionField, addAuditionSlots, removeAuditionField, removeAuditionSlot, saveAudition, setAuditionStatus } from "./actions";
import { AuditionForm, FieldForm, SlotsForm } from "./audition-forms";

export const metadata: Metadata = { title: "Audición" };

const KIND = { short_text: "Texto corto", long_text: "Texto largo", choice: "Opciones", yes_no: "Sí / No" } as const;

export default async function AuditionConfigPage({ params }: PageProps<"/s/[slug]/panel/formaciones/[id]/audicion">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio } = await requireAdmin(slug, `/panel/formaciones/${id}/audicion`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [allowed, { data: f }, { data: audition }] = await Promise.all([
    can(studio.id, "auditions"),
    supabase.from("formations").select("id, title").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase.from("auditions").select("*").eq("formation_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!f) notFound();

  const [{ data: fields }, { data: slots }, { count: applicants }] = audition
    ? await Promise.all([
        supabase.from("audition_fields").select("*").eq("audition_id", audition.id).order("sort"),
        supabase.rpc("audition_slot_availability", { p_audition_id: audition.id }),
        supabase.from("audition_applications").select("id", { count: "exact", head: true }).eq("audition_id", audition.id).neq("status", "cancelled"),
      ])
    : [{ data: [] }, { data: [] }, { count: 0 }];

  const lastDay = audition?.closes_at ? toYmd(new Date(new Date(audition.closes_at).getTime() - 1), tz) : "";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link href={`/panel/formaciones/${f.id}`} className="text-sm text-muted hover:text-foreground">
          ← {f.title}
        </Link>
        <h1 className="text-2xl font-semibold">Audición</h1>
        <p className="text-muted">Los aspirantes se inscriben, audicionan y vos decidís quién entra a la formación.</p>
      </div>

      {!allowed && !audition ? (
        <UpgradeNotice feature="auditions" what="Las audiciones" />
      ) : !audition ? (
        <AuditionForm
          action={saveAudition.bind(null, slug, f.id, null)}
          submitLabel="Crear audición"
          initial={{ title: `Audición · ${f.title}`, description: "", closesOn: "", fee: "0", videoMode: "optional", usesSlots: true }}
        />
      ) : (
        <>
          <section className="space-y-3">
            <p className="text-sm">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${audition.status === "open" ? "bg-success/10 text-success" : "bg-border text-muted"}`}
              >
                {audition.status === "open" ? "Inscripción abierta" : audition.status === "closed" ? "Inscripción cerrada" : "Borrador"}
              </span>
            </p>
            <Link
              href={`/panel/formaciones/${f.id}/audicion/aspirantes`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-4 transition hover:border-foreground hover:border-l-brand"
            >
              <span>
                <span className="block font-semibold">Aspirantes</span>
                <span className="block text-sm text-muted">
                  {applicants ?? 0} {applicants === 1 ? "inscripto" : "inscriptos"}
                </span>
              </span>
              <span className="shrink-0 font-medium text-brand">Ver y decidir →</span>
            </Link>
            {audition.status === "open" ? <CopyLink url={studioUrl(slug, `/audiciones/${audition.id}`)} /> : null}
            <div className="flex flex-wrap gap-4">
              {audition.status !== "open" ? (
                <SmallAction run={setAuditionStatus.bind(null, slug, audition.id, "open")} label="Abrir inscripción" />
              ) : (
                <SmallAction run={setAuditionStatus.bind(null, slug, audition.id, "closed")} label="Cerrar inscripción" />
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Formulario</h2>
            <p className="text-sm text-muted">El nombre, el email y el celular ya los pedimos siempre.</p>
            {fields?.length ? (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {fields.map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {q.label}
                        {q.required ? <span className="text-danger"> *</span> : null}
                      </p>
                      <p className="text-sm text-muted">
                        {KIND[q.kind]}
                        {q.kind === "choice" ? `: ${q.options.join(", ")}` : ""}
                      </p>
                    </div>
                    <SmallAction run={removeAuditionField.bind(null, slug, q.id)} label="Borrar" danger />
                  </li>
                ))}
              </ul>
            ) : null}
            <details className="rounded-2xl border border-dashed border-border p-4" open={!fields?.length}>
              <summary className="cursor-pointer font-medium">+ Agregar pregunta</summary>
              <div className="mt-4">
                <FieldForm action={addAuditionField.bind(null, slug, audition.id)} />
              </div>
            </details>
          </section>

          {audition.uses_slots ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Turnos</h2>
              {slots?.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                  {slots.map((s) => (
                    <li key={s.slot_id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <p className="text-sm">
                        {formatDayLabel(toYmd(new Date(s.starts_at), tz))} · {formatTime(s.starts_at, tz)}
                        <span className="text-muted"> · {s.remaining === 0 ? "ocupado" : `${s.remaining} libre${s.remaining === 1 ? "" : "s"}`}</span>
                      </p>
                      <SmallAction run={removeAuditionSlot.bind(null, slug, s.slot_id)} label="Borrar" danger />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Todavía no hay turnos.</p>
              )}
              <details className="rounded-2xl border border-dashed border-border p-4" open={!slots?.length}>
                <summary className="cursor-pointer font-medium">+ Generar turnos</summary>
                <div className="mt-4">
                  <SlotsForm action={addAuditionSlots.bind(null, slug, audition.id)} minDate={todayYmd(tz)} />
                </div>
              </details>
            </section>
          ) : null}

          <details className="border-t border-border pt-6">
            <summary className="cursor-pointer text-lg font-semibold">Datos de la convocatoria</summary>
            <div className="mt-4">
              <AuditionForm
                action={saveAudition.bind(null, slug, f.id, audition.id)}
                submitLabel="Guardar cambios"
                initial={{
                  title: audition.title,
                  description: audition.description ?? "",
                  closesOn: lastDay,
                  fee: audition.fee_cents ? centsToInput(audition.fee_cents) : "0",
                  videoMode: audition.video_mode as "none" | "optional" | "required",
                  usesSlots: audition.uses_slots,
                }}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
