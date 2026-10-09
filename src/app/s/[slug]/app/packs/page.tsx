import { describePackRules, parsePackRules } from "@/lib/pack-rules";
import { packRuleNames } from "@/lib/packs.server";
import type { Metadata } from "next";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { packSummary } from "@/lib/packs.server";
import { buyPack, redeemGiftCard } from "./actions";
import { RedeemGiftForm } from "./redeem-form";
import { BuyButton } from "./buy-button";
import { previewCoupon } from "../../coupon-actions";
import { can } from "@/lib/gating";

export const metadata: Metadata = { title: "Packs" };

export default async function StudentPacksPage({ params, searchParams }: PageProps<"/s/[slug]/app/packs">) {
  const { slug } = await params;
  const regalo = (await searchParams).regalo;
  const giftCode = typeof regalo === "string" && /^[A-Za-z0-9-]{4,30}$/.test(regalo) ? regalo.toUpperCase() : "";
  // Si viene del QR de una gift card, se conserva el código al pedir login.
  const { studio } = await requireStudent(slug, giftCode ? `/app/packs?regalo=${giftCode}` : "/app/packs");
  const supabase = await createClient();
  const ruleNames = await packRuleNames(studio.id);

  const [{ data: packs }, { data: canPayOnline }, couponsOn, giftsOn] = await Promise.all([
    supabase
      .from("pack_products")
      .select("id, name, description, credits, validity_days, price_cents, rules")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .order("sort")
      .order("price_cents"),
    supabase.rpc("studio_accepts_online_payments", { p_studio_id: studio.id }),
    can(studio.id, "coupons"),
    can(studio.id, "gift_cards"),
  ]);

  // El que sale más barato por clase (si hay más de uno con clases contadas).
  const perClass = (p: { credits: number | null; price_cents: number }) => (p.credits ? p.price_cents / p.credits : null);
  const counted = (packs ?? []).filter((p) => p.credits && p.price_cents > 0);
  const best = counted.length > 1 ? counted.reduce((a, b) => (perClass(b)! < perClass(a)! ? b : a)).id : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Packs</h1>
        <p className="text-sm text-muted">Valen para todas las clases del estudio, salvo que digan lo contrario.</p>
      </div>

      {!packs?.length ? (
        <p className="text-muted">El estudio todavía no publicó packs.</p>
      ) : (
        <ul className="space-y-3">
          {packs.map((p) => (
            <li
              key={p.id}
              className={`space-y-3 rounded-3xl border bg-surface p-5 ${p.id === best ? "border-brand/50 ring-2 ring-brand/10" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.name}</p>
                    {p.id === best ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-brand-foreground">Conviene</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted">{packSummary(p.credits, p.validity_days)}</p>
                  {describePackRules(parsePackRules(p.rules), ruleNames) ? (
                    <p className="text-sm font-medium text-brand">{describePackRules(parsePackRules(p.rules), ruleNames)}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-serif text-2xl font-semibold tabular-nums">{formatArs(p.price_cents)}</p>
                  {p.credits && p.credits > 1 && p.price_cents > 0 ? (
                    <p className="text-xs text-muted">{formatArs(Math.round(p.price_cents / p.credits))} por clase</p>
                  ) : null}
                </div>
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

      {giftsOn || giftCode ? <RedeemGiftForm action={redeemGiftCard.bind(null, slug)} initialCode={giftCode} /> : null}

      {!canPayOnline && packs?.length ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          Por ahora {studio.name} cobra en el estudio (efectivo o transferencia). Cuando pagues, te cargan el pack y
          lo ves acá.
        </p>
      ) : null}
    </div>
  );
}
