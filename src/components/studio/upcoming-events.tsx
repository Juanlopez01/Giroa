import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatEventWhen } from "@/lib/events";
import { nowMs } from "@/lib/datetime";

/** "Próximos eventos" del estudio (página pública y app del alumno). No muestra nada si no hay. */
export async function UpcomingEvents({ studioId, timeZone }: { studioId: string; timeZone: string }) {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, venue, starts_at, ends_at")
    .eq("studio_id", studioId)
    .eq("status", "published")
    .gt("starts_at", new Date(nowMs()).toISOString())
    .order("starts_at")
    .limit(6);
  if (!events?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Próximos eventos</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/eventos/${e.id}`}
              className="block space-y-1 rounded-2xl border border-border bg-surface p-4 transition hover:border-brand"
            >
              <p className="text-sm font-medium text-brand">{formatEventWhen(e.starts_at, e.ends_at, timeZone)}</p>
              <p className="font-semibold">{e.title}</p>
              {e.venue ? <p className="text-sm text-muted">{e.venue}</p> : null}
              <p className="pt-1 text-sm font-medium">Entradas →</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
