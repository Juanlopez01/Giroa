import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { listAgenda } from "@/lib/agenda.server";
import { addDaysYmd, nowMs, startOfDay, todayYmd } from "@/lib/datetime";
import { studioUrl } from "@/lib/urls";
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
  const supabase = await createClient();

  const today = todayYmd(studio.timezone);
  const [sessions, { count: offeringsCount }, usageRes] = await Promise.all([
    listAgenda(studio.id, startOfDay(today, studio.timezone), startOfDay(addDaysYmd(today, 1), studio.timezone)),
    supabase.from("offerings").select("id", { count: "exact", head: true }).eq("studio_id", studio.id),
    isAdmin ? supabase.rpc("studio_usage", { p_studio_id: studio.id }) : Promise.resolve({ data: null }),
  ]);
  const usage = usageRes.data as Usage | null;

  const trialDaysLeft =
    usage?.subscription_status === "trialing" && usage.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(usage.trial_ends_at).getTime() - nowMs()) / 86_400_000))
      : null;

  return (
    <div className="space-y-8">
      {trialDaysLeft !== null ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          {trialDaysLeft > 0
            ? `Te quedan ${trialDaysLeft} ${trialDaysLeft === 1 ? "día" : "días"} de prueba gratis.`
            : "Terminó tu prueba gratis. Escribinos para seguir usando Giroa."}
        </p>
      ) : null}

      {usage?.at_limit ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Llegaste al límite de {usage.max_active_students} alumnos activos de tu plan. No vas a poder sumar alumnos
          nuevos hasta que pases a un plan mayor.
        </p>
      ) : null}

      {offeringsCount === 0 ? (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <h1 className="text-xl font-semibold">Empecemos por tus clases</h1>
          <p className="text-muted">
            Cargá tus clases con sus horarios y Giroa arma la grilla de las próximas semanas. Tus alumnos la van a ver
            en {studioUrl(slug).replace(/^https?:\/\//, "")}.
          </p>
          {isAdmin ? (
            <Link
              href="/panel/clases/nueva"
              className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-medium text-brand-foreground"
            >
              Cargar mi primera clase
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-semibold">Hoy</h1>
            <Link href="/panel/agenda" className="text-sm font-medium text-brand">
              Ver la semana
            </Link>
          </div>
          {sessions.length === 0 ? (
            <p className="text-muted">Hoy no hay clases.</p>
          ) : (
            sessions.map((s) => <SessionRow key={s.id} session={s} timeZone={studio.timezone} />)
          )}
        </section>
      )}

      {usage ? (
        <p className="text-sm text-muted">
          Alumnos activos: {usage.active_students}
          {usage.max_active_students ? ` de ${usage.max_active_students}` : ""} · Plan <span className="capitalize">{usage.plan}</span>
        </p>
      ) : null}
    </div>
  );
}
