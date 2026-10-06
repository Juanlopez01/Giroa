import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMyStaffRole, getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { formatEventWhen } from "@/lib/events";
import { nowMs } from "@/lib/datetime";
import { StudioHeader } from "@/components/studio/studio-header";
import { buyTickets } from "./actions";
import { BuyForm } from "./buy-form";

async function loadEvent(slug: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const studio = await getStudioBySlug(slug);
  if (!studio) return null;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, venue, starts_at, ends_at, status")
    .eq("id", id)
    .eq("studio_id", studio.id)
    .maybeSingle();
  return event ? { studio, event } : null;
}

export async function generateMetadata({ params }: PageProps<"/s/[slug]/eventos/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const found = await loadEvent(slug, id);
  if (!found) return {};
  const when = formatEventWhen(found.event.starts_at, found.event.ends_at, found.studio.timezone);
  return {
    title: found.event.title,
    description: `${when} · ${found.studio.name}. Comprá tu entrada online.`,
  };
}

// Página pública de un evento: datos y compra de entradas (sin cuenta).
export default async function PublicEventPage({ params }: PageProps<"/s/[slug]/eventos/[id]">) {
  const { slug, id } = await params;
  const found = await loadEvent(slug, id);
  if (!found) notFound();
  const { studio, event } = found;
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: types }, { data: availability }, { data: online }, user] = await Promise.all([
    supabase
      .from("event_ticket_types")
      .select("id, name, price_cents, max_per_order")
      .eq("event_id", event.id)
      .eq("is_active", true)
      .order("sort")
      .order("price_cents"),
    supabase.rpc("event_availability", { p_event_id: event.id }),
    supabase.rpc("studio_accepts_online_payments", { p_studio_id: studio.id }),
    getCurrentUser(),
  ]);
  const [student, staffRole] = user
    ? await Promise.all([getMyStudent(studio.id, user.id), getMyStaffRole(studio.id, user.id)])
    : [null, null];

  const avail = new Map((availability ?? []).map((a) => [a.ticket_type_id, a]));
  const ended = new Date(event.ends_at ?? event.starts_at).getTime() < nowMs();

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />

      <main className="mx-auto w-full max-w-xl flex-1 space-y-8 px-5 py-8">
        {staffRole ? (
          <Link href={`/panel/eventos/${event.id}`} className="block rounded-xl bg-brand/10 px-4 py-3 text-sm">
            Estás viendo la página pública. <span className="font-medium">Ir al evento en el panel →</span>
          </Link>
        ) : null}

        <section className="space-y-3">
          <p className="text-sm font-medium tracking-wide text-brand uppercase">Evento</p>
          <h1 className="font-serif text-3xl font-semibold">{event.title}</h1>
          <p className="text-lg">{formatEventWhen(event.starts_at, event.ends_at, tz)}</p>
          <p className="text-muted">{event.venue ?? studio.name}</p>
          {event.description ? <p className="whitespace-pre-line">{event.description}</p> : null}
        </section>

        {event.status === "cancelled" ? (
          <p className="rounded-xl bg-danger/10 px-4 py-3 font-medium text-danger">
            Este evento se canceló. Si compraste entrada, el estudio se va a comunicar con vos.
          </p>
        ) : ended ? (
          <p className="rounded-xl bg-border/50 px-4 py-3 font-medium">Este evento ya pasó.</p>
        ) : !types?.length ? (
          <p className="text-muted">Todavía no hay entradas a la venta.</p>
        ) : (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Entradas</h2>
            <BuyForm
              action={buyTickets.bind(null, slug)}
              options={types.map((t) => ({
                id: t.id,
                name: t.name,
                priceCents: t.price_cents,
                maxPerOrder: t.max_per_order,
                remaining: avail.get(t.id)?.remaining ?? null,
                onSale: avail.get(t.id)?.on_sale ?? false,
                // Sin MP vinculado, las pagas se consiguen en el estudio.
                offline: t.price_cents > 0 && !online,
              }))}
              defaults={{
                name: student?.full_name ?? "",
                email: student?.email ?? user?.email ?? "",
                phone: student?.phone ?? "",
              }}
            />
          </section>
        )}
      </main>

      <footer className="px-5 py-6 text-center text-xs text-muted">Entradas con Giroa</footer>
    </div>
  );
}
