import type { Metadata } from "next";
import { requireStaff } from "@/lib/panel";
import { can } from "@/lib/gating";
import { LIBRARY_BUCKET } from "@/lib/materials";
import { listLibrary } from "@/lib/library.server";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { MaterialList } from "@/components/formations/material-list";
import { Field, Select } from "@/components/ui/field";
import { SmallAction } from "../equipo/team-controls";
import { MaterialForm } from "../formaciones/[id]/material/material-form";
import { addLibraryItem, deleteLibraryItem } from "./actions";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function LibraryPage({ params }: PageProps<"/s/[slug]/panel/biblioteca">) {
  const { slug } = await params;
  const { studio } = await requireStaff(slug, "/panel/biblioteca");
  if (!(await can(studio.id, "library"))) return <UpgradeNotice feature="library" what="La biblioteca" />;
  const items = await listLibrary(studio.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Biblioteca</h1>
        <p className="text-muted">
          Material para tus alumnos: rutinas, apuntes, playlists o videos. Lo ven en su app, en Perfil → Biblioteca. Los archivos
          se abren con un link que vence en minutos: no sirve pasarlo por WhatsApp.
        </p>
      </div>

      <MaterialForm action={addLibraryItem.bind(null, slug)} folder={studio.id} bucket={LIBRARY_BUCKET}>
        <Field label="¿Quién lo ve?">
          <Select name="audience" defaultValue="all">
            <option value="all">Todos tus alumnos</option>
            <option value="pack">Solo los que tienen un pack vigente</option>
          </Select>
        </Field>
      </MaterialForm>

      <MaterialList
        materials={items.map((m) => ({
          ...m,
          description: [m.audience === "pack" ? "Solo con pack" : "Todos", m.description].filter(Boolean).join(" · "),
        }))}
        sessions={[]}
        generalLabel="Material"
        empty="Todavía no cargaste nada."
        renderAction={(m) => (
          <SmallAction
            run={deleteLibraryItem.bind(null, slug, m.id)}
            label="Borrar"
            confirmText={`¿Borrar “${m.title}”? Tus alumnos dejan de verlo.`}
            danger
          />
        )}
      />
    </div>
  );
}
