import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";

export const metadata: Metadata = { title: "Formaciones" };

const STATUS = { draft: "Borrador", published: "Publicada", archived: "Archivada" } as const;

const fmt = (ymd: string) => ymd.split("-").reverse().map(Number).join("/");

export default async function FormationsPage({ params }: PageProps<"/s/[slug]/panel/formaciones">) {
  const { slug } = await params;
  const { studio, isAdmin } = await requireStaff(slug, "/panel/formaciones");
  const supabase = await createClient();

  const [allowed, { data: formations }, { data: enrollments }] = await Promise.all([
    can(studio.id, "formations"),
    supabase.from("formations").select("id, title, starts_on, ends_on, status, capacity").eq("studio_id", studio.id).order("starts_on", { ascending: false }),
    supabase.from("formation_enrollments").select("formation_id, status").eq("studio_id", studio.id),
  ]);

  const counts = new Map<string, { applied: number; enrolled: number }>();
  for (const e of enrollments ?? []) {
    const c = counts.get(e.formation_id) ?? { applied: 0, enrolled: 0 };
    if (e.status === "applied") c.applied += 1;
    if (e.status === "enrolled" || e.status === "approved") c.enrolled += 1;
    counts.set(e.formation_id, c);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Formaciones</h1>
        {isAdmin && allowed ? (
          <Link href="/panel/formaciones/nueva" className="inline-flex h-11 shrink-0 items-center rounded-xl bg-brand px-4 font-medium text-brand-foreground">
            + Nueva formación
          </Link>
        ) : null}
      </div>

      {!allowed && !formations?.length ? (
        <UpgradeNotice feature="formations" what="Las formaciones" />
      ) : !formations?.length ? (
        <div className="space-y-2 text-muted">
          <p>Todavía no tenés formaciones.</p>
          <p className="text-sm">
            Profesorados, programas de varios meses o intensivos: con postulación y aprobación, matrícula, cuotas,
            encuentros y asistencia.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {formations.map((f) => {
            const c = counts.get(f.id) ?? { applied: 0, enrolled: 0 };
            return (
              <li key={f.id}>
                <Link
                  href={`/panel/formaciones/${f.id}`}
                  className={`flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-foreground ${f.status === "archived" ? "opacity-60" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {f.title}
                      {f.status !== "published" ? <span className="ml-2 text-xs font-normal text-muted">{STATUS[f.status]}</span> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {fmt(f.starts_on)} al {fmt(f.ends_on)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="tabular-nums">
                      {c.enrolled}
                      {f.capacity ? `/${f.capacity}` : ""} {c.enrolled === 1 ? "inscripto" : "inscriptos"}
                    </p>
                    {c.applied ? <p className="font-medium text-brand">{c.applied} por revisar</p> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
