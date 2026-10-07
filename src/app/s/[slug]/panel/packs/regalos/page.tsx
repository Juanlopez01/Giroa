import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { formatDayLabel, nowMs, toYmd } from "@/lib/datetime";
import { GIFT_STATUS_LABEL } from "@/lib/gift-cards";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { SmallAction } from "../../equipo/team-controls";
import { cancelGiftCard, redeemForStudent, sellGiftCard } from "./actions";
import { RedeemForStudent, SellGiftForm } from "./gift-controls";

export const metadata: Metadata = { title: "Gift cards" };

export default async function GiftCardsPage({ params }: PageProps<"/s/[slug]/panel/packs/regalos">) {
  const { slug } = await params;
  const { studio, isAdmin, canTakePayments } = await requireStaff(slug, "/panel/packs/regalos");
  const tz = studio.timezone;
  const supabase = await createClient();

  const [allowed, { data: cards }, { data: packs }, { data: students }] = await Promise.all([
    can(studio.id, "gift_cards"),
    supabase
      .from("gift_cards")
      .select("id, code, pack_name, amount_cents, buyer_name, recipient_name, method, status, paid_at, expires_at, redeemed_at, redeemed_student_id, created_at")
      .eq("studio_id", studio.id)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("pack_products")
      .select("id, name, price_cents")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .eq("is_couple", false)
      .order("sort")
      .order("price_cents"),
    supabase.from("students").select("id, full_name").eq("studio_id", studio.id).eq("is_active", true).order("full_name").limit(2000),
  ]);

  const studentName = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const now = nowMs();
  const day = (iso: string) => formatDayLabel(toYmd(new Date(iso), tz));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link href="/panel/packs" className="text-sm text-muted hover:text-foreground">
          ← Packs
        </Link>
        <h1 className="text-2xl font-semibold">Gift cards</h1>
        <p className="text-muted">
          Packs de regalo. Se compran online en <span className="font-medium">/regalar</span> o los vendés acá en el mostrador.
        </p>
      </div>

      {!allowed && !cards?.length ? (
        <UpgradeNotice feature="gift_cards" what="Las gift cards" />
      ) : (
        <>
          {cards?.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {cards.map((g) => {
                const expired = g.status === "expired" || (g.status === "active" && g.expires_at !== null && new Date(g.expires_at).getTime() <= now);
                const status = expired ? "expired" : g.status;
                return (
                  <li key={g.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {g.pack_name}
                          {g.recipient_name ? ` para ${g.recipient_name}` : ""}
                        </p>
                        <p className="text-sm text-muted">
                          De {g.buyer_name} · {formatArs(g.amount_cents)}
                          {g.method === "mercadopago" ? " · online" : g.method === "cash" ? " · efectivo" : g.method === "transfer" ? " · transferencia" : ""}
                          {g.paid_at ? ` · ${day(g.paid_at)}` : ""}
                        </p>
                        <p className="font-mono text-sm">{g.code}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          status === "active" ? "bg-success/10 text-success" : "bg-border text-muted"
                        }`}
                      >
                        {GIFT_STATUS_LABEL[status]}
                      </span>
                    </div>
                    {status === "redeemed" && g.redeemed_at ? (
                      <p className="text-sm text-muted">
                        Canjeada el {day(g.redeemed_at).toLowerCase()}
                        {g.redeemed_student_id && studentName.get(g.redeemed_student_id) ? ` por ${studentName.get(g.redeemed_student_id)}` : ""}
                      </p>
                    ) : null}
                    {status === "active" ? (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <RedeemForStudent
                          students={(students ?? []).map((s) => ({ id: s.id, name: s.full_name }))}
                          redeem={redeemForStudent.bind(null, slug, g.code)}
                        />
                        {isAdmin ? (
                          <SmallAction
                            run={cancelGiftCard.bind(null, slug, g.id)}
                            label="Cancelar"
                            danger
                            confirmText="¿Cancelar esta gift card? El código deja de valer."
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted">Todavía no se vendieron gift cards.</p>
          )}

          {allowed && canTakePayments && packs?.length ? (
            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-lg font-semibold">Vender en el mostrador</h2>
              <SellGiftForm action={sellGiftCard.bind(null, slug)} packs={packs.map((p) => ({ id: p.id, name: p.name, priceCents: p.price_cents }))} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
