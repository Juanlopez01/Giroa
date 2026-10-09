import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";
import { MATERIALS_BUCKET } from "@/lib/materials";
import { MaterialList, type MaterialRow } from "@/components/formations/material-list";
import { SmallAction } from "../../../equipo/team-controls";
import { addMaterial, deleteMaterial } from "./actions";
import { MaterialForm } from "./material-form";

export const metadata: Metadata = { title: "Material" };

export default async function FormationMaterialPage({ params }: PageProps<"/s/[slug]/panel/formaciones/[id]/material">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio } = await requireStaff(slug, `/panel/formaciones/${id}/material`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: f }, { data: sessions }, { data: materials }] = await Promise.all([
    supabase.from("formations").select("id, title").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase.from("formation_sessions").select("id, title, starts_at").eq("formation_id", id).order("starts_at"),
    supabase
      .from("formation_materials")
      .select("id, title, description, kind, url, storage_path, mime_type, size_bytes, session_id, created_at")
      .eq("formation_id", id)
      .order("created_at"),
  ]);
  if (!f) notFound();

  // El staff abre los archivos con URLs firmadas (10 minutos).
  const paths = (materials ?? []).flatMap((m) => (m.storage_path ? [m.storage_path] : []));
  const { data: signed } = paths.length ? await supabase.storage.from(MATERIALS_BUCKET).createSignedUrls(paths, 600) : { data: [] };
  const urlByPath = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  const sessionLabel = (s: { title: string; starts_at: string }) =>
    `${s.title} · ${formatDayLabel(toYmd(new Date(s.starts_at), tz))} ${formatTime(s.starts_at, tz)}`;
  const rows: MaterialRow[] = (materials ?? []).map((m) => ({
    ...m,
    href: m.kind === "link" ? m.url : m.storage_path ? (urlByPath.get(m.storage_path) ?? null) : null,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link href={`/panel/formaciones/${id}`} className="text-sm text-muted hover:text-foreground">
          ← {f.title}
        </Link>
        <h1 className="font-serif text-3xl font-semibold">Material</h1>
        <p className="text-muted">
          Lo ven solo los inscriptos, en “Mi formación”. Si alguien debe una cuota, no lo ve hasta pagar. Los archivos se abren con
          un link que vence en minutos: no sirve pasarlo por WhatsApp.
        </p>
      </div>

      <MaterialForm
        action={addMaterial.bind(null, slug, id)}
        studioId={studio.id}
        formationId={id}
        sessions={(sessions ?? []).map((s) => ({ id: s.id, label: sessionLabel(s) }))}
      />

      <MaterialList
        materials={rows}
        sessions={(sessions ?? []).map((s) => ({ id: s.id, label: sessionLabel(s) }))}
        empty="Todavía no cargaste material."
        renderAction={(m) => (
          <SmallAction
            run={deleteMaterial.bind(null, slug, id, m.id)}
            label="Borrar"
            confirmText={`¿Borrar “${m.title}”? Los inscriptos dejan de verlo.`}
            danger
          />
        )}
      />
    </div>
  );
}
