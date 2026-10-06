import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { todayYmd } from "@/lib/datetime";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { createEvent } from "../actions";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Nuevo evento" };

export default async function NewEventPage({ params }: PageProps<"/s/[slug]/panel/eventos/nuevo">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/eventos/nuevo");
  const allowed = await can(studio.id, "event_tickets");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href="/panel/eventos" className="text-sm text-muted hover:text-foreground">
          ← Eventos
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo evento</h1>
        <p className="text-muted">Después le agregás las entradas y lo publicás.</p>
      </div>
      {allowed ? (
        <EventForm action={createEvent.bind(null, slug)} minDate={todayYmd(studio.timezone)} submitLabel="Crear evento" />
      ) : (
        <UpgradeNotice feature="event_tickets" what="Vender entradas para eventos" />
      )}
    </div>
  );
}
