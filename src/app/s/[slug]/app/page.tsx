import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { myAttendance, myBalances, myUpcomingBookings } from "@/lib/student-data.server";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { greeting } from "@/lib/student-home";
import { FormMessage } from "@/components/ui/field";
import { InstallPrompt } from "@/components/studio/install-prompt";
import { MyTickets } from "@/components/studio/my-tickets";
import { MyFormations } from "@/components/studio/my-formations";
import { UpcomingEvents } from "@/components/studio/upcoming-events";
import { AttendanceCard, CreditsCard, NextClassCard } from "@/components/student/home-cards";
import { createClient } from "@/lib/supabase/server";
import { Announcements } from "@/components/student/announcements";
import { dismissAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Inicio" };

export default async function StudentHomePage({ params, searchParams }: PageProps<"/s/[slug]/app">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app");
  const tz = studio.timezone;
  const welcome = (await searchParams).bienvenida === "1";
  const now = new Date(nowMs());

  const supabase = await createClient();
  const [balances, bookings, attendance, { data: trialAvailable }, { data: announcements }, { data: dismissed }, { data: failedSubs }] = await Promise.all([
    myBalances(studio.id, student.id),
    myUpcomingBookings(studio.id, student.id, now),
    myAttendance(studio.id, student.id, tz, now),
    supabase.rpc("my_trial_available", { p_studio_id: studio.id }),
    // RLS devuelve solo los anuncios para este alumno.
    supabase
      .from("announcements")
      .select("id, title, body, visible_until")
      .eq("studio_id", studio.id)
      .or(`visible_until.is.null,visible_until.gt.${now.toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("announcement_dismissals").select("announcement_id").eq("student_id", student.id),
    // Abonos con el último cobro rechazado.
    supabase.from("student_subscriptions").select("id, name").eq("student_id", student.id).eq("status", "past_due"),
  ]);
  const trial = Boolean(trialAvailable) && balances.length === 0;
  const firstName = student.full_name.split(" ")[0];
  const [next, ...rest] = bookings;
  const today = Number(toYmd(now, tz).slice(8, 10));

  return (
    <div className="space-y-6">
      {welcome ? <FormMessage ok message={`¡Listo, ${firstName}! Ya sos parte de ${studio.name}.`} /> : null}
      <Announcements
        items={(announcements ?? []).filter((a) => !(dismissed ?? []).some((d) => d.announcement_id === a.id)).slice(0, 3)}
        dismiss={dismissAnnouncement.bind(null, slug)}
      />
      {failedSubs?.length ? (
        <Link href="/app/perfil/abono" className="block rounded-2xl bg-danger/10 p-4 text-danger">
          <span className="block font-semibold">No pudimos cobrar tu abono {failedSubs[0]!.name}</span>
          <span className="block text-sm">Revisá tu tarjeta en Mercado Pago. Ver mi abono →</span>
        </Link>
      ) : null}
      <InstallPrompt studioName={studio.name} />

      <div>
        <p className="text-xs font-medium tracking-widest text-muted uppercase">{greeting(now, tz)}</p>
        <h1 className="font-serif text-3xl font-semibold">{firstName}</h1>
      </div>

      {next ? (
        <NextClassCard booking={next} timeZone={tz} now={now} />
      ) : (
        <section className="space-y-3 rounded-3xl border border-dashed border-border p-5">
          <p className="font-serif text-xl font-semibold">No tenés clases reservadas</p>
          <Link href="/app/clases" className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-brand-foreground">
            Reservar una clase
          </Link>
        </section>
      )}

      {trial ? (
        <Link href="/app/clases" className="block rounded-2xl bg-success/10 p-4 text-success">
          <span className="block font-semibold">Tu primera clase es gratis</span>
          <span className="block text-sm">Elegí qué clase querés probar →</span>
        </Link>
      ) : (
        <CreditsCard balances={balances} />
      )}

      <AttendanceCard attendance={attendance} today={today} />

      {rest.length ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Después</h2>
            <span className="h-px flex-1 bg-border" />
            <Link href="/app/reservas" className="text-sm font-medium text-brand">
              Ver todas
            </Link>
          </div>
          <ul className="space-y-2">
            {rest.slice(0, 4).map((b) => (
              <li key={b.id} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3">
                <span className="w-12 shrink-0 text-center font-semibold tabular-nums">{formatTime(b.startsAt, tz)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{b.title}</span>
                  <span className="block text-sm text-muted">
                    {b.sessionCancelled ? "Cancelada por el estudio" : formatDayLabel(toYmd(new Date(b.startsAt), tz))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <MyFormations studentId={student.id} />
      <MyTickets studentId={student.id} timeZone={tz} />
      <UpcomingEvents studioId={studio.id} timeZone={tz} />
    </div>
  );
}
