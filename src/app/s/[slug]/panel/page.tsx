import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { listAgenda } from "@/lib/agenda.server";
import { addDaysYmd, formatDayLabel, nowMs, startOfDay, todayYmd } from "@/lib/datetime";
import { formatArs } from "@/lib/money";
import { studioUrl } from "@/lib/urls";
import { greeting } from "@/lib/student-home";
import {
  activeWithoutBalance,
  expiringSoon,
  trialNotConverted,
  incomeSummary,
  occupancyBySlot,
  whatsappLink,
  type FollowUp,
} from "@/lib/dashboard.server";
import { SessionRow } from "@/components/panel/session-row";
import { LiveClassCard } from "@/components/panel/live-class-card";

export const metadata: Metadata = { title: "Panel" };

type Usage = {
  plan: string;
  max_active_students: number | null;
  active_students: number;
  at_limit: boolean;
  subscription_status: string | null;
  trial_ends_at: string | null;
};

export default async function PanelHome({ params }: PageProps<"/s/[slug]/panel">) {
  const { slug } = await params;
  const { studio, isAdmin } = await requireStaff(slug);
  const tz = studio.timezone;
  const now = new Date(nowMs());
  const supabase = await createClient();

  const today = todayYmd(tz);
  const [sessions, { count: offeringsCount }] = await Promise.all([
    listAgenda(studio.id, startOfDay(today, tz), startOfDay(addDaysYmd(today, 1), tz)),
    supabase.from("offerings").select("id", { count: "exact", head: true }).eq("studio_id", studio.id),
  ]);

  const owner = isAdmin
    ? await Promise.all([
        supabase.rpc("studio_usage", { p_studio_id: studio.id }),
        incomeSummary(studio.id, tz, now),
        expiringSoon(studio.id, tz, now),
        activeWithoutBalance(studio.id, now),
        occupancyBySlot(studio.id, tz, now),
        trialNotConverted(studio.id, now),
      ])
    : null;
  const usage = (owner?.[0].data ?? null) as Usage | null;
  const income = owner?.[1];
  const expiring = owner?.[2] ?? [];
  const noBalance = owner?.[3] ?? [];
  const slots = owner?.[4] ?? [];
  const trials = owner?.[5] ?? [];

  if (offeringsCount === 0) {
    return (
      <section className="space-y-3 rounded-3xl border border-border bg-surface p-6">
        <h1 className="font-serif text-2xl font-semibold">Empecemos por tus clases</h1>
        <p className="text-muted">
          Cargá tus clases con sus horarios y Giroa arma la grilla de las próximas semanas. Tus alumnos la van a ver en{" "}
          {studioUrl(slug).replace(/^https?:\/\//, "")}.
        </p>
        {isAdmin ? (
          <Link href="/panel/clases/nueva" className="inline-flex h-12 items-center rounded-full bg-brand px-6 font-medium text-brand-foreground">
            Cargar mi primera clase
          </Link>
        ) : null}
      </section>
    );
  }

  const delta = income ? income.thisMonth - income.lastMonthSameDay : 0;
  // La clase en curso o la próxima de hoy.
  const live = sessions.find((s) => s.status === "scheduled" && new Date(s.endsAt).getTime() >= now.getTime());
  const followUps = expiring.length + noBalance.length + trials.length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium tracking-widest text-muted uppercase">{greeting(now, tz)}</p>
        <h1 className="font-serif text-3xl font-semibold">Hoy · {formatDayLabel(today)}</h1>
      </div>

      {usage?.at_limit ? (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Llegaste al límite de {usage.max_active_students} alumnos activos de tu plan. No vas a poder sumar alumnos
          nuevos hasta que pases a un plan mayor.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ---------------------------------------------------------- ahora */}
        <div className="space-y-3">
          {live ? (
            <LiveClassCard session={live} timeZone={tz} now={now} />
          ) : (
            <section className="rounded-3xl border border-dashed border-border p-5">
              <p className="font-serif text-xl font-semibold">{sessions.length ? "Terminaron las clases de hoy" : "Hoy no hay clases"}</p>
              <Link href="/panel/agenda" className="text-sm font-medium text-brand">
                Ver la semana →
              </Link>
            </section>
          )}
          {sessions.length > (live ? 1 : 0) ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 pt-2">
                <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Clases de hoy</h2>
                <span className="h-px flex-1 bg-border" />
                <Link href="/panel/agenda" className="text-sm font-medium text-brand">
                  Semana
                </Link>
              </div>
              {sessions
                .filter((s) => s.id !== live?.id)
                .map((s) => (
                  <SessionRow key={s.id} session={s} timeZone={tz} />
                ))}
            </div>
          ) : null}
        </div>

        {/* ---------------------------------------------------------- números */}
        {income && usage ? (
          <section className="grid content-start grid-cols-2 gap-3">
            <Link href="/panel/pagos" className="col-span-2 rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40">
              <p className="text-xs font-medium tracking-widest text-muted uppercase">Cobrado este mes</p>
              <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{formatArs(income.thisMonth)}</p>
              <p className={`text-sm ${income.lastMonthSameDay > 0 ? (delta >= 0 ? "text-success" : "text-danger") : "text-muted"}`}>
                {income.lastMonthSameDay > 0
                  ? `${delta >= 0 ? "▲" : "▼"} ${formatArs(Math.abs(delta))} vs. el mes pasado a esta altura`
                  : `${income.count} ${income.count === 1 ? "pago" : "pagos"}`}
              </p>
            </Link>
            <Stat
              label="Alumnos activos"
              value={String(usage.active_students)}
              hint={usage.max_active_students ? `de ${usage.max_active_students} de tu plan` : "sin límite"}
              pct={usage.max_active_students ? usage.active_students / usage.max_active_students : undefined}
              href="/panel/alumnos"
            />
            <Stat label="Packs por vencer" value={String(expiring.length)} hint="en los próximos 7 días" />
          </section>
        ) : null}
      </div>

      {/* ---------------------------------------------------------- para hacer hoy */}
      {isAdmin && followUps > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Para hacer hoy</h2>
            <p className="text-sm text-muted">Un mensaje a tiempo es un pack renovado.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {expiring.length ? (
              <FollowUpList
                title="Su pack vence pronto"
                people={expiring}
                message={(p) => `¡Hola ${p.name.split(" ")[0]}! Te escribimos de ${studio.name}: tu pack vence en estos días. ¿Querés renovarlo?`}
              />
            ) : null}
            {noBalance.length ? (
              <FollowUpList
                title="Vienen pero no tienen saldo"
                people={noBalance}
                message={(p) => `¡Hola ${p.name.split(" ")[0]}! Te escribimos de ${studio.name}: se te terminaron las clases del pack. ¿Te cargamos uno nuevo?`}
              />
            ) : null}
            {trials.length ? (
              <FollowUpList
                title="Probaron y no compraron"
                people={trials}
                message={(p) => `¡Hola ${p.name.split(" ")[0]}! Te escribimos de ${studio.name}: ¿qué te pareció la clase de prueba? Si querés seguir, te paso los packs.`}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- ocupación */}
      {isAdmin && slots.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Ocupación</h2>
            <p className="text-sm text-muted">Promedio de las últimas 4 semanas, por clase y horario.</p>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {slots.map((s) => (
              <li key={s.key} className="space-y-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">
                    {s.title} <span className="font-normal text-muted">· {s.label}</span>
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{s.pct}%</p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                  <div
                    className={`h-full rounded-full ${s.hint === "low" ? "bg-muted" : s.hint === "full" ? "bg-[var(--gold,#c8a46b)]" : "bg-brand"}`}
                    style={{ width: `${Math.min(100, s.pct)}%` }}
                  />
                </div>
                <p className="text-sm text-muted">
                  {s.avgBooked} de {s.capacity} por clase
                  {s.roleBalance ? ` · ${s.avgLeaders} líderes y ${s.avgFollowers} seguidores/as en promedio` : ""}
                  {s.hint === "full" ? <span className="font-medium text-brand"> · Se llena: conviene abrir otro horario</span> : null}
                  {s.hint === "low" ? <span className="font-medium text-foreground"> · Poca gente: revisá el horario o el nivel</span> : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint, href, pct }: { label: string; value: string; hint?: string; href?: string; pct?: number }) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-widest text-muted uppercase">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
      {pct !== undefined ? (
        <div className="my-1.5 h-1 overflow-hidden rounded-full bg-border/60" aria-hidden>
          <div className={`h-full rounded-full ${pct >= 0.9 ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
        </div>
      ) : null}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-border bg-surface p-4">{body}</div>
  );
}

function FollowUpList({ title, people, message }: { title: string; people: FollowUp[]; message: (p: FollowUp) => string }) {
  return (
    <div className="space-y-1 rounded-2xl border border-border bg-surface p-4">
      <p className="font-semibold">
        {title} <span className="font-normal text-muted">· {people.length}</span>
      </p>
      <ul className="divide-y divide-border">
        {people.slice(0, 6).map((p) => {
          const wa = whatsappLink(p.phone, message(p));
          const initials = p.name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]!.toUpperCase())
            .join("");
          return (
            <li key={p.studentId} className="flex items-center gap-3 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {initials}
              </span>
              <Link href={`/panel/alumnos/${p.studentId}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted">{p.detail}</p>
              </Link>
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-[#25d366] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  WhatsApp
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      {people.length > 6 ? <p className="pt-1 text-xs text-muted">Y {people.length - 6} más.</p> : null}
    </div>
  );
}
