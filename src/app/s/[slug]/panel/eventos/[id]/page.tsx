import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { centsToInput, formatArs } from "@/lib/money";
import { todayYmd, toHhmm, toYmd } from "@/lib/datetime";
import { EVENT_STATUS_LABEL, formatEventWhen, ORDER_STATUS_LABEL } from "@/lib/events";
import { formatDayLabel, formatTime } from "@/lib/datetime";
import { studioUrl } from "@/lib/urls";
import { FormMessage } from "@/components/ui/field";
import {
  createTicketType,
  deleteEvent,
  setEventStatus,
  setTicketTypeActive,
  updateEvent,
  updateTicketType,
  cancelOrder,
} from "../actions";
import { CancelOrderButton } from "./sales";
import { EventForm } from "../event-form";
import { CopyLink, EventStatusControls, TicketTypeForm } from "./controls";

export const metadata: Metadata = { title: "Evento" };

const METHOD = { mercadopago: "Mercado Pago", cash: "Efectivo", transfer: "Transferencia" } as const;

export default async function EventPage({ params, searchParams }: PageProps<"/s/[slug]/panel/eventos/[id]">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const created = (await searchParams).nuevo === "1";
  const { studio, isAdmin } = await requireStaff(slug, `/panel/eventos/${id}`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: event }, { data: types }, { data: availability }, { data: orders }, { data: online }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase.from("event_ticket_types").select("*").eq("event_id", id).order("sort").order("price_cents"),
    supabase.rpc("event_availability", { p_event_id: id }),
    supabase
      .from("event_orders")
      .select("id, quantity, amount_cents, status, method, buyer_name, buyer_email, buyer_phone, created_at, notes, ticket_type_id")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("studio_accepts_online_payments", { p_studio_id: studio.id }),
  ]);
  if (!event) notFound();

  const remaining = new Map((availability ?? []).map((a) => [a.ticket_type_id, a.remaining]));
  const paid = (orders ?? []).filter((o) => o.status === "paid");
  const soldCount = paid.reduce((n, o) => n + o.quantity, 0);
  const income = paid.reduce((n, o) => n + o.amount_cents, 0);
  const publicUrl = studioUrl(slug, `/eventos/${event.id}`);
  const typeName = new Map((types ?? []).map((t) => [t.id, t.name]));
  // Las reservas que vencieron sin pagar no aportan nada a la lista.
  const visibleOrders = (orders ?? []).filter((o) => o.status !== "expired");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link href="/panel/eventos" className="text-sm text-muted hover:text-foreground">
          ← Eventos
        </Link>
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-muted">
          {formatEventWhen(event.starts_at, event.ends_at, tz)}
          {event.venue ? ` · ${event.venue}` : ""}
        </p>
        <p className="text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              event.status === "published" ? "bg-success/10 text-success" : "bg-border text-muted"
            }`}
          >
            {EVENT_STATUS_LABEL[event.status]}
          </span>
        </p>
      </div>

      {created ? (
        <FormMessage ok message="¡Evento creado! Ahora agregale las entradas y publicalo." />
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Entradas vendidas</p>
          <p className="text-2xl font-semibold tabular-nums">{soldCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Recaudado</p>
          <p className="text-2xl font-semibold tabular-nums">{formatArs(income)}</p>
        </div>
      </section>

      {event.status === "published" ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Link para compartir</h2>
          <CopyLink url={publicUrl} />
          <p className="text-sm text-muted">Mandalo por WhatsApp o ponelo en tu Instagram. No hace falta tener cuenta para comprar.</p>
        </section>
      ) : null}

      {event.status !== "draft" ? (
        <Link
          href={`/panel/eventos/${event.id}/puerta`}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-brand-foreground"
        >
          Puerta: escanear entradas y vender
        </Link>
      ) : null}

      {isAdmin ? (
        <EventStatusControls
          status={event.status}
          hasOrders={(orders ?? []).length > 0}
          setStatus={setEventStatus.bind(null, slug, event.id)}
          remove={deleteEvent.bind(null, slug, event.id)}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Entradas</h2>
        {!online && types?.some((t) => t.price_cents > 0) ? (
          <p className="rounded-xl bg-[var(--gold)]/15 px-4 py-3 text-sm">
            Para vender las entradas pagas online, vinculá tu Mercado Pago en{" "}
            <Link href="/panel/ajustes" className="font-medium underline">
              Ajustes
            </Link>
            . Mientras tanto, se pueden conseguir en el estudio.
          </p>
        ) : null}
        {!types?.length ? (
          <p className="text-muted">Todavía no hay entradas. Agregá al menos una para poder publicar.</p>
        ) : (
          <ul className="space-y-3">
            {types.map((t) => {
              const left = remaining.get(t.id);
              const salesEnd = t.sales_end_at ? toYmd(new Date(new Date(t.sales_end_at).getTime() - 1), tz) : "";
              return (
                <li key={t.id} className={`rounded-2xl border border-border bg-surface p-4 ${t.is_active ? "" : "opacity-60"}`}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-medium">
                      {t.name}
                      {!t.is_active ? <span className="ml-2 text-xs font-normal text-muted">Pausada</span> : null}
                    </p>
                    <p className="font-semibold tabular-nums">{t.price_cents ? formatArs(t.price_cents) : "Gratis"}</p>
                  </div>
                  <p className="text-sm text-muted">
                    {t.quantity === null ? "Sin límite de cupo" : `Quedan ${left ?? 0} de ${t.quantity}`}
                    {salesEnd ? ` · se vende hasta el ${salesEnd.split("-").reverse().slice(0, 2).join("/")}` : ""}
                  </p>
                  {isAdmin ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-brand">Editar</summary>
                      <div className="mt-4 space-y-4">
                        <TicketTypeForm
                          action={updateTicketType.bind(null, slug, t.id)}
                          submitLabel="Guardar"
                          initial={{
                            name: t.name,
                            price: t.price_cents ? centsToInput(t.price_cents) : "0",
                            quantity: t.quantity === null ? "" : String(t.quantity),
                            maxPerOrder: t.max_per_order,
                            salesEndDate: salesEnd,
                          }}
                        />
                        <form action={setTicketTypeActive.bind(null, slug, t.id, !t.is_active)}>
                          <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
                            {t.is_active ? "Pausar la venta de esta entrada" : "Volver a vender esta entrada"}
                          </button>
                        </form>
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {isAdmin && event.status !== "cancelled" ? (
          <details className="rounded-2xl border border-dashed border-border p-4" open={!types?.length}>
            <summary className="cursor-pointer font-medium">+ Agregar entrada</summary>
            <div className="mt-4">
              <TicketTypeForm action={createTicketType.bind(null, slug, event.id)} submitLabel="Agregar entrada" />
            </div>
          </details>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Compras</h2>
        {!visibleOrders.length ? (
          <p className="text-muted">Todavía no hay compras.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {visibleOrders.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {o.buyer_name} · {o.quantity} × {typeName.get(o.ticket_type_id) ?? "Entrada"}
                  </p>
                  <p className="text-sm text-muted">
                    {formatDayLabel(toYmd(new Date(o.created_at), tz))} {formatTime(o.created_at, tz)} ·{" "}
                    {o.amount_cents ? formatArs(o.amount_cents) : "Gratis"}
                    {o.method ? ` · ${METHOD[o.method]}` : ""}
                    {o.status !== "paid" ? ` · ${ORDER_STATUS_LABEL[o.status]}` : ""}
                  </p>
                  {o.buyer_email || o.buyer_phone ? (
                    <p className="truncate text-sm text-muted">{[o.buyer_email, o.buyer_phone].filter(Boolean).join(" · ")}</p>
                  ) : null}
                  {o.notes ? <p className="text-sm whitespace-pre-line text-danger">{o.notes}</p> : null}
                </div>
                {isAdmin && (o.status === "paid" || o.status === "pending") ? (
                  <CancelOrderButton cancel={cancelOrder.bind(null, slug, o.id)} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <details className="border-t border-border pt-6">
          <summary className="cursor-pointer text-lg font-semibold">Datos del evento</summary>
          <div className="mt-4">
            <EventForm
              action={updateEvent.bind(null, slug, event.id)}
              minDate={todayYmd(tz)}
              submitLabel="Guardar cambios"
              initial={{
                title: event.title,
                description: event.description ?? "",
                venue: event.venue ?? "",
                date: toYmd(new Date(event.starts_at), tz),
                startTime: toHhmm(event.starts_at, tz),
                endTime: event.ends_at ? toHhmm(event.ends_at, tz) : "",
              }}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
