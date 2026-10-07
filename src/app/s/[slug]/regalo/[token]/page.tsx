import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, toYmd } from "@/lib/datetime";
import { studioUrl } from "@/lib/urls";
import { StudioHeader } from "@/components/studio/studio-header";
import { AutoRefresh } from "../../entradas/[token]/auto-refresh";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Tu regalo", robots: { index: false } };

type Gift = {
  code: string;
  status: "pending" | "active" | "redeemed" | "cancelled" | "expired";
  pack_name: string;
  credits: number | null;
  validity_days: number;
  recipient_name: string | null;
  buyer_name: string;
  message: string | null;
  expires_at: string | null;
  studio: { name: string; slug: string };
};

// La tarjeta de regalo: link privado para quien la compró (y para compartir).
export default async function GiftCardPage({ params }: PageProps<"/s/[slug]/regalo/[token]">) {
  const { slug, token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_gift_card", { p_access_token: token });
  const gift = data as Gift | null;
  if (!gift || gift.studio.slug !== slug) notFound();

  const redeemUrl = studioUrl(slug, `/app/packs?regalo=${encodeURIComponent(gift.code)}`);
  const qr = await QRCode.toString(redeemUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1917", light: "#ffffff" } });
  const shareText = `${gift.recipient_name ? `¡${gift.recipient_name}! ` : ""}Te regalo ${gift.pack_name} en ${studio.name} 🎁 Canjealo con el código ${gift.code} acá: ${redeemUrl}`;
  const until = gift.expires_at ? formatDayLabel(toYmd(new Date(gift.expires_at), studio.timezone)).toLowerCase() : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="print:hidden">
        <StudioHeader studio={studio} />
      </div>
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-8">
        {gift.status === "pending" ? (
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">Estamos confirmando tu pago…</p>
            <p className="text-sm text-muted">Apenas Mercado Pago lo apruebe, la tarjeta aparece acá sola.</p>
            <AutoRefresh />
          </div>
        ) : gift.status === "cancelled" ? (
          <p className="rounded-xl bg-border/50 px-4 py-3">Este regalo fue cancelado.</p>
        ) : (
          <>
            <article className="space-y-4 rounded-3xl bg-brand p-6 text-center text-brand-foreground shadow-sm">
              <p className="text-sm tracking-wide uppercase opacity-80">Gift card · {studio.name}</p>
              {gift.recipient_name ? <p className="font-serif text-2xl">Para {gift.recipient_name}</p> : null}
              <p className="font-serif text-3xl font-semibold">{gift.pack_name}</p>
              {gift.message ? <p className="text-base whitespace-pre-line italic opacity-90">&ldquo;{gift.message}&rdquo;</p> : null}
              <p className="text-sm opacity-80">De parte de {gift.buyer_name}</p>
              <div
                className="mx-auto w-40 rounded-2xl bg-white p-2"
                // SVG generado en el servidor por la librería qrcode.
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="font-mono text-lg font-semibold tracking-wider">{gift.code}</p>
              {gift.status === "redeemed" ? (
                <p className="rounded-xl bg-white/15 py-2 text-sm font-medium">Ya fue canjeada ✓</p>
              ) : gift.status === "expired" ? (
                <p className="rounded-xl bg-white/15 py-2 text-sm font-medium">Venció</p>
              ) : until ? (
                <p className="text-xs opacity-80">Se canjea hasta el {until}</p>
              ) : null}
            </article>

            {gift.status === "active" ? (
              <div className="space-y-3 print:hidden">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 items-center justify-center rounded-xl bg-[#25d366] font-semibold text-white"
                >
                  Mandar por WhatsApp
                </a>
                <PrintButton />
                <p className="text-center text-sm text-muted">
                  Para canjearla: escaneá el QR o entrá a {studio.name}, sumate y poné el código en Packs. Las clases
                  empiezan a correr desde el canje.
                </p>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
