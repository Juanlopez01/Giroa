import type { Metadata } from "next";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { packSummary } from "@/lib/packs.server";
import { buyPack } from "./actions";
import { BuyButton } from "./buy-button";
import { previewCoupon } from "../../coupon-actions";
import { can } from "@/lib/gating";

export const metadata: Metadata = { title: "Packs" };

export default async function StudentPacksPage({ params }: PageProps<"/s/[slug]/app/packs">) {
  const { slug } = await params;
  const { studio } = await requireStudent(slug, "/app/packs");
  const supabase = await createClient();

  const [{ data: packs }, { data: canPayOnline }, couponsOn] = await Promise.all([
    supabase
      .from("pack_products")
      .select("id, name, description, credits, validity_days, price_cents")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .order("sort")
      .order("price_cents"),
    supabase.rpc("studio_accepts_online_payments", { p_studio_id: studio.id }),
    can(studio.id, "coupons"),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Comprá tu pack</h1>
        <p className="text-sm text-muted">Vale para todas las clases del estudio.</p>
      </div>

      {!packs?.length ? (
        <p className="text-muted">El estudio todavía no publicó packs.</p>
      ) : (
        <ul className="space-y-3">
          {packs.map((p) => (
            <li key={p.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted">{packSummary(p.credits, p.validity_days)}</p>
                </div>
                <p className="shrink-0 text-lg font-semibold tabular-nums">{formatArs(p.price_cents)}</p>
              </div>
              {p.description ? <p className="text-sm">{p.description}</p> : null}
              {canPayOnline ? (
                <BuyButton
                  buy={buyPack.bind(null, slug, p.id)}
                  preview={couponsOn && p.price_cents > 0 ? previewCoupon.bind(null, slug, "packs", p.price_cents) : undefined}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!canPayOnline && packs?.length ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          Por ahora {studio.name} cobra en el estudio (efectivo o transferencia). Cuando pagues, te cargan el pack y
          lo ves acá.
        </p>
      ) : null}
    </div>
  );
}
