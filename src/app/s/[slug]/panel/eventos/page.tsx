import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { EVENT_STATUS_LABEL, formatEventWhen } from "@/lib/events";
import { nowMs } from "@/lib/datetime";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";

export const metadata: Metadata = { title: "Eventos" };

export default async function EventsPage({ params }: PageProps<"/s/[slug]/panel/eventos">) {
  const { slug } = await params;
  const { studio, isAdmin } = await requireStaff(slug, "/panel/eventos");
  const supabase = await createClient();

  const [allowed, { data: events }, { data: sold }] = await Promise.all([
    can(studio.id, "event_tickets"),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, status")
      .eq("studio_id", studio.id)
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase.from("event_orders").select("event_id, quantity").eq("studio_id", studio.id).eq("status", "paid"),
  ]);

  const soldBy = new Map<string, number>();
  for (const o of sold ?? []) soldBy.set(o.event_id, (soldBy.get(o.event_id) ?? 0) + o.quantity);
  const now = nowMs();
  const upcoming = (events ?? []).filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now).reverse();
  const past = (events ?? []).filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() < now);

  const row = (e: NonNullable<typeof events>[number]) => (
    <li key={e.id}>
      <Link
        href={`/panel/eventos/${e.id}`}
        className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-foreground"
      >
        <div className="min-w-0">
          <p className="font-medium">
            {e.title}
            {e.status !== "published" ? (
              <span className="ml-2 text-xs font-normal text-muted">{EVENT_STATUS_LABEL[e.status]}</span>
            ) : null}
          </p>
          <p className="text-sm text-muted">{formatEventWhen(e.starts_at, e.ends_at, studio.timezone)}</p>
        </div>
        <p className="shrink-0 text-sm text-muted tabular-nums">
          {soldBy.get(e.id) ?? 0} {soldBy.get(e.id) === 1 ? "entrada" : "entradas"}
        </p>
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Eventos</h1>
        {isAdmin && allowed ? (
          <Link
            href="/panel/eventos/nuevo"
            className="inline-flex h-11 shrink-0 items-center rounded-xl bg-brand px-4 font-medium text-brand-foreground"
          >
            + Nuevo evento
          </Link>
        ) : null}
      </div>

      {!allowed && !events?.length ? (
        <UpgradeNotice feature="event_tickets" what="Vender entradas para eventos" />
      ) : !events?.length ? (
        <div className="space-y-2 text-muted">
          <p>Todavía no creaste eventos.</p>
          <p className="text-sm">
            Milongas, seminarios, muestras: cualquiera compra su entrada con Mercado Pago (no hace falta que sea alumno) y
            la controlás en la puerta con el QR.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length ? <ul className="space-y-3">{upcoming.map(row)}</ul> : <p className="text-muted">No tenés eventos próximos.</p>}
          {past.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">Anteriores</h2>
              <ul className="space-y-3 opacity-70">{past.map(row)}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
