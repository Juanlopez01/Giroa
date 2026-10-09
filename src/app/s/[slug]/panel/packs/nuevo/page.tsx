import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { packRuleOptions, studioOffersCouplePacks } from "@/lib/packs.server";
import { createPack } from "../actions";
import { PackForm } from "../pack-form";

export const metadata: Metadata = { title: "Nuevo pack" };

export default async function NewPackPage({ params }: PageProps<"/s/[slug]/panel/packs/nuevo">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/packs/nuevo");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href="/panel/packs" className="text-sm text-muted hover:text-foreground">
          ← Packs
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo pack</h1>
        <p className="text-muted">Vale para todas las clases regulares del estudio.</p>
      </div>
      <PackForm
        action={createPack.bind(null, slug)}
        allowCouple={await studioOffersCouplePacks(studio.id)}
        ruleOptions={await packRuleOptions(studio.id)}
        submitLabel="Crear pack"
      />
    </div>
  );
}
