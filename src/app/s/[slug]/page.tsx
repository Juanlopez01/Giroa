import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMyStaffRole, getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { listPublicSessions, type PublicSession } from "@/lib/public-schedule.server";
import { createClient } from "@/lib/supabase/server";
import { addDaysYmd, formatDayLabel, isYmd, nowMs, startOfDay, todayYmd, toYmd } from "@/lib/datetime";
import { formatArs } from "@/lib/money";
import { packSummary } from "@/lib/packs.server";
import { StudioHeader } from "@/components/studio/studio-header";
import { SessionCard } from "@/components/studio/session-card";
import { UpcomingEvents } from "@/components/studio/upcoming-events";
import { can } from "@/lib/gating";

// Página pública del estudio ({slug}.giroa.com.ar): grilla, packs y "Sumate".
export default async function StudioPublicPage({ params, searchParams }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();
  const tz = studio.timezone;

  const today = todayYmd(tz);
  const desde = (await searchParams).desde;
  const from = isYmd(desde) && desde >= today ? desde : today;
  const supabase = await createClient();

  const [sessions, { data: packs }, user] = await Promise.all([
    // Hoy, solo lo que todavía no empezó.
    listPublicSessions(
      slug,
      from === today ? new Date(nowMs()) : startOfDay(from, tz),
      startOfDay(addDaysYmd(from, 7), tz),
    ),
    supabase
      .from("pack_products")
      .select("id, name, description, credits, validity_days, price_cents")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .order("sort")
      .order("price_cents"),
    getCurrentUser(),
  ]);

  const [trialOn, giftsOn] = await Promise.all([
    can(studio.id, "trial_class").then((ok) => ok && studio.trial_class_enabled),
    can(studio.id, "gift_cards"),
  ]);
  const { data: formations } = await supabase
    .from("formations")
    .select("id, title, starts_on, enrollment_open, requires_approval")
    .eq("studio_id", studio.id)
    .eq("status", "published")
    .order("starts_on");
  const [student, staffRole] = user
    ? await Promise.all([getMyStudent(studio.id, user.id), getMyStaffRole(studio.id, user.id)])
    : [null, null];

  const byDay = new Map<string, PublicSession[]>();
  for (const s of sessions) {
    const day = toYmd(new Date(s.startsAt), tz);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(from, i)).filter((d) => byDay.has(d));

  const cta = student ? (
    <Link href="/app" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-foreground">
      Mi cuenta
    </Link>
  ) : (
    <Link href="/sumate" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-foreground">
      Sumate
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} action={cta} variant="hero" />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-5 py-8">
        {staffRole ? (
          <Link href="/panel" className="block rounded-xl bg-brand/10 px-4 py-3 text-sm">
            Estás viendo la página pública. <span className="font-medium">Ir al panel →</span>
          </Link>
        ) : null}

        {!student ? (
          <section className="space-y-3">
            <h1 className="text-2xl font-semibold">{trialOn ? "Tu primera clase es gratis" : "Reservá tu clase online"}</h1>
            <p className="text-muted">
              {trialOn
                ? `Sumate a ${studio.name} y elegí qué clase querés probar. Si te gusta, comprás tu pack y reservás desde el celular.`
                : `Sumate a ${studio.name}, comprá tu pack y reservá tu lugar desde el celular. Sin llamadas ni mensajes.`}
            </p>
            <Link
              href="/sumate"
              className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-medium text-brand-foreground"
            >
              {trialOn ? "Probá una clase gratis" : `Sumate a ${studio.name}`}
            </Link>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Clases</h2>
            <div className="flex gap-1 text-sm">
              {from > today ? (
                <Link href={`/?desde=${addDaysYmd(from, -7) < today ? today : addDaysYmd(from, -7)}`} className="rounded-lg px-3 py-2 hover:bg-surface">
                  ← Antes
                </Link>
              ) : null}
              <Link href={`/?desde=${addDaysYmd(from, 7)}`} className="rounded-lg px-3 py-2 hover:bg-surface">
                Próxima semana →
              </Link>
            </div>
          </div>

          {days.length === 0 ? (
            <p className="text-muted">No hay clases programadas para estos días.</p>
          ) : (
            days.map((day) => (
              <div key={day} className="space-y-2">
                <h3 className={`text-sm font-semibold ${day === today ? "text-brand" : "text-muted"}`}>
                  {day === today ? "Hoy · " : ""}
                  {formatDayLabel(day)}
                </h3>
                {(byDay.get(day) ?? []).map((s) => (
                  <SessionCard key={s.id} session={s} timeZone={tz} />
                ))}
              </div>
            ))
          )}
          {!student && sessions.length > 0 ? (
            <p className="text-sm text-muted">
              Para reservar,{" "}
              <Link href="/sumate" className="font-medium text-brand">
                sumate al estudio
              </Link>
              .
            </p>
          ) : null}
        </section>

        <UpcomingEvents studioId={studio.id} timeZone={tz} />

        {formations?.length ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Formaciones</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {formations.map((fo) => (
                <li key={fo.id}>
                  <Link href={`/formaciones/${fo.id}`} className="block space-y-1 rounded-2xl border border-border bg-surface p-4 transition hover:border-brand">
                    <p className="text-sm font-medium text-brand">Empieza el {fo.starts_on.split("-").reverse().map(Number).join("/")}</p>
                    <p className="font-semibold">{fo.title}</p>
                    <p className="pt-1 text-sm font-medium">
                      {fo.enrollment_open ? (fo.requires_approval ? "Postulaciones abiertas →" : "Inscripción abierta →") : "Ver más →"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {giftsOn && packs?.length ? (
          <Link href="/regalar" className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand">
            <span>
              <span className="block text-lg font-semibold">🎁 Regalá clases</span>
              <span className="block text-sm text-muted">Una gift card con un pack para quien quieras.</span>
            </span>
            <span className="shrink-0 font-medium text-brand">Regalar →</span>
          </Link>
        ) : null}

        {packs?.length ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Packs</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {packs.map((p) => (
                <li key={p.id} className="space-y-1 rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{formatArs(p.price_cents)}</p>
                  </div>
                  <p className="text-sm text-muted">{packSummary(p.credits, p.validity_days)}</p>
                  {p.description ? <p className="text-sm">{p.description}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <footer className="px-5 py-6 text-center text-xs text-muted">Reservas con Giroa</footer>
    </div>
  );
}
