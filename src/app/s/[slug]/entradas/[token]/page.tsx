import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { confirmMpReturn } from "@/lib/mp/apply-payment";
import { formatEventWhen, TICKET_QR_PREFIX } from "@/lib/events";
import { formatArs } from "@/lib/money";
import { StudioHeader } from "@/components/studio/studio-header";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Tus entradas", robots: { index: false } };

type Order = {
  id: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "refunded";
  quantity: number;
  buyer_name: string;
  amount_cents: number;
  ticket_type: string;
  event: { id: string; title: string; venue: string | null; starts_at: string; ends_at: string | null; status: string };
  studio: { name: string; slug: string; timezone: string };
  tickets: { number: number; qr_token: string; status: "valid" | "cancelled"; checked_in_at: string | null }[];
};

// "Tus entradas": link privado (el token es aleatorio). No requiere cuenta.
export default async function TicketsPage({ params, searchParams }: PageProps<"/s/[slug]/entradas/[token]">) {
  const { slug, token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();
  const sp = await searchParams;
  const estado = sp.estado;

  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();
  await confirmMpReturn(studio.id, sp);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_event_order", { p_access_token: token });
  const order = data as Order | null;
  if (!order || order.studio.slug !== slug) notFound();

  const qrs = await Promise.all(
    order.tickets.map((t) =>
      QRCode.toString(`${TICKET_QR_PREFIX}${t.qr_token}`, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#1c1917", light: "#ffffff" },
      }),
    ),
  );
  const when = formatEventWhen(order.event.starts_at, order.event.ends_at, order.studio.timezone);

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-8">
        <section className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold">{order.event.title}</h1>
          <p>{when}</p>
          <p className="text-muted">{order.event.venue ?? order.studio.name}</p>
        </section>

        {order.status === "pending" ? (
          estado === "rechazado" ? (
            <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
              <p className="font-semibold">El pago no se pudo hacer</p>
              <p className="text-sm text-muted">No se cobró nada. Podés intentar de nuevo con otro medio de pago.</p>
              <Link href={`/eventos/${order.event.id}`} className="inline-block font-medium text-brand">
                Volver al evento →
              </Link>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
              <p className="font-semibold">Estamos confirmando tu pago…</p>
              <p className="text-sm text-muted">
                Apenas Mercado Pago lo apruebe, tus entradas aparecen acá solas. Puede tardar unos segundos.
              </p>
              <AutoRefresh />
            </div>
          )
        ) : order.status === "paid" ? (
          <>
            <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              ¡Listo, {order.buyer_name.split(" ")[0]}! Mostrá{" "}
              {order.quantity === 1 ? "este QR" : "estos QR"} en la entrada. Guardá este link o sacale una captura.
            </p>
            <ul className="space-y-4">
              {order.tickets.map((t, i) => (
                <li key={t.number} className="rounded-3xl border border-border bg-surface p-5 text-center">
                  <p className="text-sm text-muted">
                    {order.ticket_type}
                    {order.quantity > 1 ? ` · ${t.number} de ${order.quantity}` : ""}
                  </p>
                  {t.status === "cancelled" ? (
                    <p className="py-10 font-semibold text-danger">Entrada cancelada</p>
                  ) : (
                    <div
                      className="mx-auto my-3 w-full max-w-64 rounded-2xl bg-white p-3"
                      // SVG generado en el servidor por la librería qrcode a partir de un token hex.
                      dangerouslySetInnerHTML={{ __html: qrs[i] ?? "" }}
                    />
                  )}
                  <p className="font-medium">{order.buyer_name}</p>
                  {t.checked_in_at ? <p className="text-sm text-muted">Ya ingresó</p> : null}
                </li>
              ))}
            </ul>
            {order.amount_cents ? (
              <p className="text-center text-sm text-muted">Pagaste {formatArs(order.amount_cents)}.</p>
            ) : null}
          </>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">
              {order.status === "refunded"
                ? "Esta compra fue reintegrada."
                : order.status === "cancelled"
                  ? "Esta compra está cancelada."
                  : "Esta reserva venció sin pagarse."}
            </p>
            <Link href={`/eventos/${order.event.id}`} className="inline-block font-medium text-brand">
              Ver el evento →
            </Link>
          </div>
        )}
      </main>
      <footer className="px-5 py-6 text-center text-xs text-muted">Entradas con Giroa</footer>
    </div>
  );
}
