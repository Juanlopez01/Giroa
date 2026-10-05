import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { trimTime, WEEKDAYS } from "@/lib/datetime";

export const metadata: Metadata = { title: "Clases" };

export default async function OfferingsPage({ params }: PageProps<"/s/[slug]/panel/clases">) {
  const { slug } = await params;
  const { studio, isAdmin } = await requireStaff(slug, "/panel/clases");
  const supabase = await createClient();

  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, title, level, capacity, is_active, teacher_name, disciplines(name), class_schedules(weekday, start_time, is_active)")
    .eq("studio_id", studio.id)
    .eq("kind", "regular")
    .order("is_active", { ascending: false })
    .order("title");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Clases</h1>
        {isAdmin ? (
          <Link
            href="/panel/clases/nueva"
            className="inline-flex h-11 shrink-0 items-center rounded-xl bg-brand px-4 font-medium text-brand-foreground"
          >
            + Nueva clase
          </Link>
        ) : null}
      </div>

      {!offerings?.length ? (
        <p className="text-muted">Todavía no cargaste clases.</p>
      ) : (
        <ul className="space-y-3">
          {offerings.map((o) => {
            const schedules = o.class_schedules
              .filter((s) => s.is_active)
              .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
            return (
              <li key={o.id}>
                <Link
                  href={`/panel/clases/${o.id}`}
                  className={`block rounded-2xl border border-border bg-surface p-4 transition hover:border-foreground ${o.is_active ? "" : "opacity-60"}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{o.title}</p>
                    {!o.is_active ? <span className="text-xs text-muted">Pausada</span> : null}
                  </div>
                  <p className="text-sm text-muted">
                    {[o.disciplines?.name, o.level, o.teacher_name, `cupo ${o.capacity}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-sm">
                    {schedules.length
                      ? schedules.map((s) => `${WEEKDAYS[s.weekday]?.slice(0, 3)} ${trimTime(s.start_time)}`).join(" · ")
                      : "Sin horarios"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
