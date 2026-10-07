import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { createFormation } from "../actions";
import { FormationForm } from "../formation-form";

export const metadata: Metadata = { title: "Nueva formación" };

export default async function NewFormationPage({ params }: PageProps<"/s/[slug]/panel/formaciones/nueva">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/formaciones/nueva");
  const allowed = await can(studio.id, "formations");
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href="/panel/formaciones" className="text-sm text-muted hover:text-foreground">
          ← Formaciones
        </Link>
        <h1 className="text-2xl font-semibold">Nueva formación</h1>
        <p className="text-muted">Después le agregás los encuentros y la publicás.</p>
      </div>
      {allowed ? (
        <FormationForm action={createFormation.bind(null, slug)} submitLabel="Crear formación" />
      ) : (
        <UpgradeNotice feature="formations" what="Las formaciones" />
      )}
    </div>
  );
}
