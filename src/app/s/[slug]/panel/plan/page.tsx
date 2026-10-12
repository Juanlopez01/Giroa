import { isPlanComingSoon } from "@/lib/gating";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { daysUntil, getStudioAccess } from "@/lib/subscription.server";
import { formatArs } from "@/lib/money";
import { nowMs } from "@/lib/datetime";
import { FormMessage } from "@/components/ui/field";
import { cancelSubscription, chooseTrialPlan, subscribe } from "./actions";
import { CancelSubscriptionButton } from "./cancel-button";
import { PlanPicker } from "./plan-picker";
import { getFounderSpots } from "@/lib/founder.server";
import { ShareInvite } from "@/components/student/share-invite";
import { studioReferralLink, studioReferralMessage } from "@/lib/studio-referrals";

type ReferralSummary = { pending: number; rewarded: number; discount_pct: number; step_pct: number; max_pct: number };

export const metadata: Metadata = { title: "Tu plan" };

export default async function PlanPage({ params, searchParams }: PageProps<"/s/[slug]/panel/plan">) {
  const { slug } = await params;
  const { studio } = await requireOwner(slug, "/panel/plan");
  const mpOk = (await searchParams).mp === "ok";
  const supabase = await createClient();

  const [access, { data: plans }, founder, { data: summary }] = await Promise.all([
    getStudioAccess(studio.id),
    supabase.from("plans").select("key, name, monthly_price_cents, max_active_students").order("sort"),
    getFounderSpots(),
    supabase.rpc("studio_referral_summary", { p_studio_id: studio.id }),
  ]);
  const referrals = (summary as ReferralSummary | null) ?? { pending: 0, rewarded: 0, discount_pct: 0, step_pct: 10, max_pct: 25 };
  const referralLink = studioReferralLink(slug);
  const options = (plans ?? []).map((p) => ({
    key: p.key,
    name: p.name,
    monthlyCents: p.monthly_price_cents,
    limit: p.max_active_students,
    highlight: p.key === "estudio",
    soon: isPlanComingSoon(p.key),
    founder: founder[p.key]?.spotsLeft ? founder[p.key]! : null,
  }));
  const now = nowMs();
  const days = daysUntil(access.until, now);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Tu plan</h1>

      {mpOk ? (
        <FormMessage ok message="¡Gracias! Estamos confirmando la suscripción con Mercado Pago. En unos segundos se activa tu plan." />
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5">
        {access.state === "trial" ? (
          <p>
            Estás en la <span className="font-medium">prueba gratis</span>
            {days !== null ? ` (te ${days === 1 ? "queda 1 día" : `quedan ${days} días`})` : ""}, probando el plan{" "}
            <span className="font-medium capitalize">{access.plan}</span>. Suscribite cuando quieras: no se cobra nada
            hasta que lo hagas.
          </p>
        ) : access.state === "active" ? (
          <div className="space-y-1">
            <p>
              Plan <span className="font-medium capitalize">{access.subscribed_plan ?? access.plan}</span>{" "}
              {access.billing_cycle === "annual" ? "anual" : "mensual"}
              {access.amount_cents ? ` · ${formatArs(access.amount_cents)}` : ""}
              {access.discount_pct ? ` (con ${access.discount_pct}% de descuento)` : ""}.
            </p>
            {access.status === "cancelled" ? (
              <p className="text-sm text-muted">Cancelaste la suscripción: tenés acceso hasta el fin del período pagado.</p>
            ) : (
              <p className="text-sm text-success">Suscripción activa con débito automático.</p>
            )}
          </div>
        ) : access.state === "grace" ? (
          <p className="text-danger">
            {access.status === "past_due"
              ? "No pudimos cobrar tu suscripción."
              : "Terminó tu prueba gratis."}{" "}
            Tenés {days === 1 ? "1 día" : `${days} días`} para suscribirte antes de que el panel quede bloqueado. Tus
            alumnos siguen reservando con normalidad.
          </p>
        ) : (
          <p className="text-danger">
            Tu panel está pausado. Suscribite para volver a usarlo. Tus alumnos siguen viendo su saldo y reservando.
          </p>
        )}
      </section>

      {!(access.state === "active" && access.status === "active") ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Elegí tu plan</h2>
          <PlanPicker
            plans={options}
            currentPlan={access.plan}
            inTrial={access.state === "trial"}
            referralPct={referrals.discount_pct}
            subscribe={subscribe.bind(null, slug)}
            chooseTrialPlan={chooseTrialPlan.bind(null, slug)}
          />
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Cambiar de plan</h2>
          <PlanPicker
            plans={options}
            currentPlan={access.subscribed_plan ?? access.plan}
            inTrial={false}
            referralPct={referrals.discount_pct}
            subscribe={subscribe.bind(null, slug)}
            chooseTrialPlan={chooseTrialPlan.bind(null, slug)}
          />
          <p className="text-sm text-muted">
            Al suscribirte al plan nuevo, cancelamos el anterior automáticamente.
          </p>
          <CancelSubscriptionButton cancel={cancelSubscription.bind(null, slug)} />
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Recomendá Giroa</h2>
          <p className="text-sm text-muted">
            Por cada estudio o profe que se suma con tu link y paga su primer mes, tu plan baja un {referrals.step_pct}% más,
            de por vida (hasta {referrals.max_pct}%). Se suma a tu descuento de fundador.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-border/30 p-3">
            <dt className="text-xs text-muted">Se sumaron</dt>
            <dd className="text-xl font-semibold tabular-nums">{referrals.pending + referrals.rewarded}</dd>
          </div>
          <div className="rounded-xl bg-border/30 p-3">
            <dt className="text-xs text-muted">Ya pagan</dt>
            <dd className="text-xl font-semibold tabular-nums">{referrals.rewarded}</dd>
          </div>
          <div className="rounded-xl bg-border/30 p-3">
            <dt className="text-xs text-muted">Tu descuento</dt>
            <dd className="text-xl font-semibold tabular-nums">{referrals.discount_pct}%</dd>
          </div>
        </dl>
        <ShareInvite link={referralLink} message={studioReferralMessage(referralLink)} />
        <p className="text-xs text-muted">
          El link también está en el pie de tus páginas (&ldquo;Reservas con Giroa&rdquo;): si un estudio se registra desde
          ahí, cuenta como recomendación tuya.
        </p>
      </section>
    </div>
  );
}
