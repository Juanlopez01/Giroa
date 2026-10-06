import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatEventWhen } from "@/lib/events";
import { QrScanner } from "@/components/panel/qr-scanner";
import { scanTicket, sellManual } from "../../actions";
import { ManualSaleForm } from "../sales";

export const metadata: Metadata = { title: "Puerta" };

// Control de entradas el día del evento: escáner, ingresos y venta en la puerta.
export default async function DoorPage({ params }: PageProps<"/s/[slug]/panel/eventos/[id]/puerta">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio } = await requireStaff(slug, `/panel/eventos/${id}/puerta`);
  const supabase = await createClient();

  const [{ data: event }, { data: tickets }, { data: types }] = await Promise.all([
    supabase.from("events").select("id, title, starts_at, ends_at, status").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase.from("event_tickets").select("checked_in_at").eq("event_id", id).eq("status", "valid"),
    supabase.from("event_ticket_types").select("id, name, price_cents").eq("event_id", id).order("sort").order("price_cents"),
  ]);
  if (!event) notFound();

  const total = tickets?.length ?? 0;
  const inside = (tickets ?? []).filter((t) => t.checked_in_at).length;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <Link href={`/panel/eventos/${id}`} className="text-sm text-muted hover:text-foreground">
          ← {event.title}
        </Link>
        <h1 className="text-2xl font-semibold">Puerta</h1>
        <p className="text-muted">{formatEventWhen(event.starts_at, event.ends_at, studio.timezone)}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 text-center">
        <p className="text-sm text-muted">Ingresaron</p>
        <p className="text-3xl font-semibold tabular-nums">
          {inside} <span className="text-lg font-normal text-muted">de {total}</span>
        </p>
      </div>

      <QrScanner scan={scanTicket.bind(null, slug, id)} hint="Apuntá al QR de la entrada." />

      {event.status !== "cancelled" && types?.length ? (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Vender en la puerta</h2>
          <ManualSaleForm
            action={sellManual.bind(null, slug)}
            types={types.map((t) => ({ id: t.id, name: t.name, priceCents: t.price_cents }))}
          />
        </section>
      ) : null}
    </div>
  );
}
