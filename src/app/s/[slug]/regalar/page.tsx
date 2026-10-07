import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { packSummary } from "@/lib/packs.server";
import { StudioHeader } from "@/components/studio/studio-header";
import { buyGiftCard } from "./actions";
import { GiftForm } from "./gift-form";

export async function generateMetadata({ params }: PageProps<"/s/[slug]/regalar">): Promise<Metadata> {
  const studio = await getStudioBySlug((await params).slug);
  return studio ? { title: "Regalá clases", description: `Regalá un pack de clases en ${studio.name}.` } : {};
}

// "Regalá clases": comprar una gift card de un pack (sin cuenta).
export default async function GiftPage({ params }: PageProps<"/s/[slug]/regalar">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();
  const supabase = await createClient();

  const [allowed, { data: online }, { data: packs }] = await Promise.all([
    can(studio.id, "gift_cards"),
    supabase.rpc("studio_accepts_online_payments", { p_studio_id: studio.id }),
    supabase
      .from("pack_products")
      .select("id, name, credits, validity_days, price_cents, is_couple")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .eq("is_couple", false)
      .gt("price_cents", 0)
      .order("sort")
      .order("price_cents"),
  ]);
  if (!allowed) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-5 py-8">
        <section className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-brand uppercase">Gift card</p>
          <h1 className="font-serif text-3xl font-semibold">Regalá clases en {studio.name}</h1>
          <p className="text-muted">Elegí un pack, dejale un mensaje y compartí la tarjeta por WhatsApp o impresa.</p>
        </section>
        {!online ? (
          <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
            Por ahora los regalos se compran en el estudio. Consultá en {studio.name}.
          </p>
        ) : !packs?.length ? (
          <p className="text-muted">Todavía no hay packs para regalar.</p>
        ) : (
          <GiftForm
            action={buyGiftCard.bind(null, slug)}
            options={packs.map((p) => ({
              id: p.id,
              name: p.name,
              summary: packSummary(p.credits, p.validity_days),
              priceCents: p.price_cents,
            }))}
          />
        )}
      </main>
      <footer className="px-5 py-6 text-center text-xs text-muted">Regalos con Giroa</footer>
    </div>
  );
}
