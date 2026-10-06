import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Feature gating central. La fuente de verdad es public.plan_features (la misma
// que usa studio_has_feature en SQL). Nada de ifs por plan dispersos: siempre
// can(studioId, "feature").

export const FEATURES = [
  // Núcleo (Profe e Inicial)
  "students",
  "regular_classes",
  "packs",
  "manual_payments",
  "mp_checkout",
  "qr_checkin",
  "reminders",
  "student_app",
  "income_dashboard",
  "csv_import",
  "role_balance",
  "couple_packs",
  "equipment_capacity",
  "levels",
  // Estudio
  "specials",
  "event_tickets",
  "formations",
  "auditions",
  "waitlist",
  "trial_class",
  "churn_alert",
  "pack_freeze",
  "library",
  "coupons",
  "gift_cards",
  "referrals",
  "embed_widget",
  "teacher_permissions",
  // Pro
  "certificates",
  "audition_jury",
  "audition_rubrics",
  "audition_video",
  "auto_waitlist_admission",
  "teacher_payouts",
  "multi_site",
  "custom_domain",
  "arca_invoicing",
  "sell_material",
  "advanced_reports",
  "priority_support",
] as const;

export type Feature = (typeof FEATURES)[number];

export type StudioPlanInfo = {
  plan: string;
  planName: string;
  features: ReadonlySet<Feature>;
};

/** Plan y features del estudio (memoizado por request). */
export const getStudioPlan = cache(async (studioId: string): Promise<StudioPlanInfo> => {
  const supabase = await createClient();
  const { data: studio } = await supabase
    .from("studios")
    .select("plan, plans(name, plan_features(feature))")
    .eq("id", studioId)
    .maybeSingle();

  const features = new Set<Feature>(
    (studio?.plans?.plan_features ?? [])
      .map((f) => f.feature)
      .filter((f): f is Feature => (FEATURES as readonly string[]).includes(f)),
  );
  return { plan: studio?.plan ?? "inicial", planName: studio?.plans?.name ?? "Inicial", features };
});

export async function can(studioId: string, feature: Feature): Promise<boolean> {
  return (await getStudioPlan(studioId)).features.has(feature);
}

/** Plan más barato que incluye la feature (para el mensaje de "pasate a…"). */
export async function cheapestPlanWith(feature: Feature): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_features")
    .select("plans(name, sort)")
    .eq("feature", feature);
  const plans = (data ?? []).flatMap((r) => (r.plans ? [r.plans] : [])).sort((a, b) => a.sort - b.sort);
  return plans[0]?.name ?? null;
}
