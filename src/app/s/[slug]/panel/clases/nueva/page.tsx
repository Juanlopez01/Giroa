import type { Metadata } from "next";
import { listTeamOptions } from "@/lib/studio.server";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { listDisciplines } from "@/lib/disciplines.server";
import { can } from "@/lib/gating";
import { createOffering } from "../actions";
import { OfferingForm } from "../offering-form";

export const metadata: Metadata = { title: "Nueva clase" };

export default async function NewOfferingPage({ params }: PageProps<"/s/[slug]/panel/clases/nueva">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/clases/nueva");
  const [disciplines, allowRoleBalance, teachers, allowDropIn] = await Promise.all([
    listDisciplines(),
    can(studio.id, "role_balance"),
    listTeamOptions(studio.id),
    can(studio.id, "drop_in"),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href="/panel/clases" className="text-sm text-muted hover:text-foreground">
          ← Clases
        </Link>
        <h1 className="text-2xl font-semibold">Nueva clase</h1>
        <p className="text-muted">Después le cargás los horarios de la semana.</p>
      </div>
      <OfferingForm action={createOffering.bind(null, slug)} disciplines={disciplines} submitLabel="Crear clase" allowRoleBalance={allowRoleBalance} allowDropIn={allowDropIn} teachers={teachers.length > 1 ? teachers : []} />
    </div>
  );
}
