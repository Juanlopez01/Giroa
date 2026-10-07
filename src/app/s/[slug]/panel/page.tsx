import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { listAgenda } from "@/lib/agenda.server";
import { addDaysYmd, nowMs, startOfDay, todayYmd } from "@/lib/datetime";
import { formatArs } from "@/lib/money";
import { studioUrl } from "@/lib/urls";
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
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h1 className="text-xl font-semibold">Empecemos por tus clases</h1>
        <p className="text-muted">
          Cargá tus clases con sus horarios y Giroa arma la grilla de las próximas semanas. Tus alumnos la van a ver en{" "}
          {studioUrl(slug).replace(/^https?:\/\//, "")}.
        </p>
        {isAdmin ? (
          <Link href="/panel/clases/nueva" className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-medium text-brand-foreground">
            Cargar mi primera clase
          </Link>
        ) : null}
      </section>
    );
  }

  const delta = income ? income.thisMonth - income.lastMonthSameDay : 0;

  return (
    <div className="space-y-8">
      {usage?.at_limit ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Llegaste al límite de {usage.max_active_students} alumnos activos de tu plan. No vas a poder sumar alumnos
          nuevos hasta que pases a un plan mayor.
        </p>
      ) : null}

      {/* ---------------------------------------------------------- números */}
      {income && usage ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link
            href="/panel/pagos"
            className="col-span-2 rounded-2xl border border-border border-l-4 border-l-brand bg-surface p-4 transition hover:border-foreground hover:border-l-brand"
          >
            <p className="text-sm text-muted">Cobrado este mes</p>
            <p className="text-3xl font-semibold tabular-nums">{formatArs(income.thisMonth)}</p>
            <p className={`text-sm ${income.lastMonthSameDay > 0 ? (delta >= 0 ? "text-success" : "text-danger") : "text-muted"}`}>
              {income.lastMonthSameDay > 0
                ? `${delta >= 0 ? "▲" : "▼"} ${formatArs(Math.abs(delta))} vs. el mes pasado a esta altura`
                : `${income.count} ${income.count === 1 ? "pago" : "pagos"}`}
            </p>
          </Link>
          <Stat label="Alumnos activos" value={`${usage.active_students}${usage.max_active_students ? ` / ${usage.max_active_students}` : ""}`} href="/panel/alumnos" />
          <Stat label="Packs por vencer" value={String(expiring.length)} hint="en 7 días" />
        </section>
      ) : null}

      {/* ---------------------------------------------------------- hoy */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Hoy</h2>
          <Link href="/panel/agenda" className="text-sm font-medium text-brand">
            Ver la semana
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="text-muted">Hoy no hay clases.</p>
        ) : (
          sessions.map((s) => <SessionRow key={s.id} session={s} timeZone={tz} />)
        )}
      </section>

      {/* ---------------------------------------------------------- a quién escribirle */}
      {isAdmin && (expiring.length > 0 || noBalance.length > 0 || trials.length > 0) ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Para escribirles</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FollowUpList
              title="Su pack vence pronto"
              empty="Nadie tiene el pack por vencer esta semana."
              people={expiring}
              message={(p) => `¡Hola ${p.name.split(" ")[0]}! Te escribimos de ${studio.name}: tu pack vence en estos días. ¿Querés renovarlo?`}
            />
            <FollowUpList
              title="Vienen pero no tienen saldo"
              empty="Todos los que vienen tienen saldo."
              people={noBalance}
              message={(p) => `¡Hola ${p.name.split(" ")[0]}! Te escribimos de ${studio.name}: se te terminaron las clases del pack. ¿Te cargamos uno nuevo?`}
            />
            {trials.length > 0 ? (
              <FollowUpList
                title="Probaron y no compraron"
                empty=""
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
            <h2 className="text-xl font-semibold">Ocupación</h2>
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
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full ${s.hint === "low" ? "bg-muted" : "bg-brand"}`}
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

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl border border-border bg-surface p-4 hover:border-foreground">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-border bg-surface p-4">{body}</div>
  );
}

function FollowUpList({
  title,
  empty,
  people,
  message,
}: {
  title: string;
  empty: string;
  people: FollowUp[];
  message: (p: FollowUp) => string;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <p className="font-medium">
        {title} <span className="text-muted">({people.length})</span>
      </p>
      {people.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {people.slice(0, 8).map((p) => {
            const wa = whatsappLink(p.phone, message(p));
            return (
              <li key={p.studentId} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/panel/alumnos/${p.studentId}`} className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted">{p.detail}</p>
                </Link>
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg bg-[#25d366] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
