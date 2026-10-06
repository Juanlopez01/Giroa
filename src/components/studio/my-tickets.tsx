import "server-only";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEventWhen } from "@/lib/events";
import { nowMs } from "@/lib/datetime";

/**
 * Entradas que compró el alumno (logueado) para eventos que todavía no pasaron.
 * Las órdenes solo las lee el staff por RLS: acá se leen con service role,
 * filtrando por el student_id que resolvió el servidor (nunca el cliente).
 */
export async function MyTickets({ studentId, timeZone }: { studentId: string; timeZone: string }) {
  const { data } = await createAdminClient()
    .from("event_orders")
    .select("access_token, quantity, events!inner(title, starts_at, ends_at)")
    .eq("student_id", studentId)
    .eq("status", "paid")
    .gt("events.starts_at", new Date(nowMs() - 12 * 3_600_000).toISOString())
    .limit(10);
  if (!data?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Tus entradas</h2>
      <ul className="space-y-2">
        {data.map((o) => (
          <li key={o.access_token}>
            <Link
              href={`/entradas/${o.access_token}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <span className="min-w-0">
                <span className="block font-medium">{o.events.title}</span>
                <span className="block text-sm text-muted">{formatEventWhen(o.events.starts_at, o.events.ends_at, timeZone)}</span>
              </span>
              <span className="shrink-0 text-sm font-medium text-brand">
                {o.quantity === 1 ? "Ver QR" : `Ver ${o.quantity} QR`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
