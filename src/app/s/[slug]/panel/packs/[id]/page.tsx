import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { centsToInput } from "@/lib/money";
import { studioOffersCouplePacks } from "@/lib/packs.server";
import { setPackActive, updatePack } from "../actions";
import { PackForm } from "../pack-form";

export const metadata: Metadata = { title: "Pack" };

export default async function PackPage({ params }: PageProps<"/s/[slug]/panel/packs/[id]">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio } = await requireAdmin(slug, `/panel/packs/${id}`);
  const supabase = await createClient();

  const [{ data: pack }, allowCouple] = await Promise.all([
    supabase.from("pack_products").select("*").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    studioOffersCouplePacks(studio.id),
  ]);
  if (!pack) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-1">
        <Link href="/panel/packs" className="text-sm text-muted hover:text-foreground">
          ← Packs
        </Link>
        <h1 className="text-2xl font-semibold">{pack.name}</h1>
        {!pack.is_active ? <p className="text-muted">Pausado: tus alumnos no lo ven.</p> : null}
      </div>

      <PackForm
        action={updatePack.bind(null, slug, pack.id)}
        allowCouple={allowCouple || pack.is_couple}
        submitLabel="Guardar cambios"
        initial={{
          name: pack.name,
          description: pack.description ?? "",
          credits: pack.credits,
          validityDays: pack.validity_days,
          price: centsToInput(pack.price_cents),
          isCouple: pack.is_couple,
        }}
      />

      <section className="space-y-2 border-t border-border pt-6">
        <form action={setPackActive.bind(null, slug, pack.id, !pack.is_active)}>
          <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
            {pack.is_active ? "Pausar este pack" : "Volver a ofrecer este pack"}
          </button>
        </form>
        <p className="text-sm text-muted">
          {pack.is_active
            ? "Pausado deja de venderse. Los alumnos que ya lo compraron lo siguen usando."
            : "Vuelve a aparecer para que tus alumnos lo compren."}
        </p>
      </section>
    </div>
  );
}
