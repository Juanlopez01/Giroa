import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { importStudents } from "../actions";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Importar alumnos" };

export default async function ImportStudentsPage({ params }: PageProps<"/s/[slug]/panel/alumnos/importar">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/alumnos/importar");
  const allowed = await can(studio.id, "csv_import");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/panel/alumnos" className="text-sm text-muted hover:text-foreground">
          ← Alumnos
        </Link>
        <h1 className="text-2xl font-semibold">Importar alumnos</h1>
        <p className="text-muted">Traé tus alumnos y sus saldos desde la planilla que usás hoy.</p>
      </div>
      {allowed ? (
        <ImportForm importAction={importStudents.bind(null, slug)} />
      ) : (
        <UpgradeNotice feature="csv_import" what="El import desde Excel" />
      )}
    </div>
  );
}
