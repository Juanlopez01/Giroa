import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudioBySlug } from "@/lib/studio.server";
import { listPublicSessions, type PublicSession } from "@/lib/public-schedule.server";
import { addDaysYmd, formatDayLabel, formatTime, isYmd, nowMs, startOfDay, todayYmd, toYmd } from "@/lib/datetime";
import { can } from "@/lib/gating";
import { marketingUrl, studioUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Clases", robots: { index: false } };

// Widget para la web del estudio (feature 'embed_widget'): la grilla de la
// semana en un <iframe>. Es la única ruta que se puede mostrar dentro de otros
// sitios (ver next.config.ts). Los links abren la app en una pestaña nueva.
export default async function EmbedPage({ params, searchParams }: PageProps<"/s/[slug]/embed">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  if (!(await can(studio.id, "embed_widget"))) {
    return <p className="p-6 text-center text-sm text-muted">Este widget no está disponible.</p>;
  }

  const tz = studio.timezone;
  const today = todayYmd(tz);
  const desde = (await searchParams).desde;
  const from = isYmd(desde) && desde >= today ? desde : today;
  const sessions = await listPublicSessions(
    slug,
    from === today ? new Date(nowMs()) : startOfDay(from, tz),
    startOfDay(addDaysYmd(from, 7), tz),
  );
  const byDay = new Map<string, PublicSession[]>();
  for (const s of sessions) {
    const ymd = toYmd(new Date(s.startsAt), tz);
    byDay.set(ymd, [...(byDay.get(ymd) ?? []), s]);
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-semibold">Clases de {studio.name}</h1>
        <nav className="flex gap-1 text-sm">
          {from > today ? (
            <a href={`?desde=${addDaysYmd(from, -7) < today ? today : addDaysYmd(from, -7)}`} className="rounded-full border border-border bg-surface px-3 py-1">
              ← Antes
            </a>
          ) : null}
          <a href={`?desde=${addDaysYmd(from, 7)}`} className="rounded-full border border-border bg-surface px-3 py-1">
            Después →
          </a>
        </nav>
      </div>

      {!byDay.size ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">No hay clases esta semana.</p>
      ) : (
        [...byDay.entries()].map(([ymd, list]) => (
          <section key={ymd} className="space-y-2">
            <h2 className="text-xs font-medium tracking-widest text-muted uppercase">{formatDayLabel(ymd)}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {list.map((s) => {
                const full = !s.cancelled && s.spotsLeft <= 0;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-12 shrink-0 font-semibold tabular-nums">{formatTime(s.startsAt, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {[s.disciplineName, s.teacherName, s.cancelled ? "Cancelada" : full ? "Completa" : `${s.spotsLeft} lugares`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {s.cancelled ? null : (
                      <a
                        href={studioUrl(slug, `/app/clases?dia=${ymd}`)}
                        target="_blank"
                        rel="noopener"
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${full ? "border border-border text-muted" : "bg-brand text-brand-foreground"}`}
                      >
                        {full ? "Lista de espera" : "Reservar"}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <p className="text-center text-xs text-muted">
        Reservas con{" "}
        <a href={marketingUrl("/")} target="_blank" rel="noopener" className="font-medium hover:underline">
          Giroa
        </a>
      </p>
    </main>
  );
}
