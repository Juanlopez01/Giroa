import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { nowMs, toYmd } from "@/lib/datetime";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { createCoupon, setCouponActive } from "./actions";
import { CouponForm } from "./coupon-form";

export const metadata: Metadata = { title: "Cupones" };

const TARGET = { all: "Packs y entradas", packs: "Solo packs", events: "Solo entradas" } as const;

export default async function CouponsPage({ params }: PageProps<"/s/[slug]/panel/packs/cupones">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/packs/cupones");
  const supabase = await createClient();

  const [allowed, { data: coupons }, { data: uses }] = await Promise.all([
    can(studio.id, "coupons"),
    supabase.from("coupons").select("*").eq("studio_id", studio.id).order("created_at", { ascending: false }),
    supabase.from("coupon_redemptions").select("coupon_id, discount_cents").eq("studio_id", studio.id).eq("status", "confirmed"),
  ]);

  const stats = new Map<string, { count: number; total: number }>();
  for (const u of uses ?? []) {
    const s = stats.get(u.coupon_id) ?? { count: 0, total: 0 };
    stats.set(u.coupon_id, { count: s.count + 1, total: s.total + u.discount_cents });
  }
  const now = nowMs();
  const tz = studio.timezone;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link href="/panel/packs" className="text-sm text-muted hover:text-foreground">
          ← Packs
        </Link>
        <h1 className="text-2xl font-semibold">Cupones de descuento</h1>
        <p className="text-muted">Códigos para las compras online de packs y entradas. Ideales para promos y redes.</p>
      </div>

      {!allowed && !coupons?.length ? (
        <UpgradeNotice feature="coupons" what="Los cupones de descuento" />
      ) : (
        <>
          {coupons?.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {coupons.map((c) => {
                const st = stats.get(c.id) ?? { count: 0, total: 0 };
                const expired = c.valid_until !== null && new Date(c.valid_until).getTime() <= now;
                const exhausted = c.max_uses !== null && st.count >= c.max_uses;
                const lastDay = c.valid_until ? toYmd(new Date(new Date(c.valid_until).getTime() - 1), tz).split("-").reverse().slice(0, 2).join("/") : null;
                return (
                  <li key={c.id} className={`flex items-start justify-between gap-3 p-4 ${c.is_active && !expired ? "" : "opacity-60"}`}>
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-mono font-semibold tracking-wide">{c.code}</p>
                      <p className="text-sm">
                        {c.kind === "percent" ? `${c.value}% off` : `${formatArs(c.value)} off`} · {TARGET[c.applies_to]}
                      </p>
                      <p className="text-sm text-muted">
                        {st.count} {st.count === 1 ? "uso" : "usos"}
                        {c.max_uses ? ` de ${c.max_uses}` : ""}
                        {st.total ? ` · descontaste ${formatArs(st.total)}` : ""}
                        {lastDay ? ` · vale hasta el ${lastDay}` : ""}
                        {c.once_per_person ? " · una vez por persona" : ""}
                      </p>
                      {expired ? <p className="text-sm text-danger">Venció</p> : exhausted ? <p className="text-sm text-danger">Sin usos disponibles</p> : null}
                    </div>
                    <form action={setCouponActive.bind(null, slug, c.id, !c.is_active)}>
                      <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
                        {c.is_active ? "Pausar" : "Activar"}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted">Todavía no creaste códigos.</p>
          )}

          {allowed ? (
            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-lg font-semibold">Nuevo código</h2>
              <CouponForm action={createCoupon.bind(null, slug)} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
