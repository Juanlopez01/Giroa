"use server";

import { isPlanComingSoon } from "@/lib/gating";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseError, type ActionState } from "@/lib/errors";
import { cancelPreapproval, createPreapproval } from "@/lib/mp/subscriptions";
import { studioUrl } from "@/lib/urls";

const planSchema = z.enum(["profe", "inicial", "estudio", "pro"]);
const cycleSchema = z.enum(["monthly", "annual"]);

/** Durante la prueba: cambiar el plan que se está probando. */
export async function chooseTrialPlan(slug: string, plan: string): Promise<ActionState> {
  const { studio } = await requireOwner(slug, "/panel/plan");
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, message: "Ese plan no existe." };
  if (isPlanComingSoon(parsed.data)) return { ok: false, message: "Ese plan llega pronto: por ahora elegí otro." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("choose_trial_plan", { p_studio_id: studio.id, p_plan: parsed.data });
  if (error) return fromSupabaseError(error, "chooseTrialPlan");
  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true, message: "Listo: ahora estás probando este plan." };
}

/**
 * Suscribirse: calcula el precio en la base (plan, ciclo y código), crea la
 * suscripción en MP con el token de Giroa y manda a autorizar el débito.
 * El plan se activa recién cuando el webhook confirma la autorización.
 */
export async function subscribe(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireOwner(slug, "/panel/plan");
  const plan = planSchema.safeParse(formData.get("plan"));
  const cycle = cycleSchema.safeParse(formData.get("cycle"));
  if (!plan.success || !cycle.success) return { ok: false, message: "Elegí un plan." };
  if (isPlanComingSoon(plan.data)) return { ok: false, message: "Ese plan llega pronto: por ahora elegí otro." };
  const coupon = String(formData.get("coupon") ?? "").trim().toUpperCase() || null;
  if (!user.email) return { ok: false, message: "Tu cuenta no tiene email. Escribinos para suscribirte." };

  const supabase = await createClient();
  const { data: quote, error } = await supabase.rpc("giroa_quote", {
    p_plan: plan.data,
    p_cycle: cycle.data,
    p_coupon: coupon ?? undefined,
  });
  if (error) {
    const state = fromSupabaseError(error, "subscribe.quote");
    return state.code === "invalid_coupon" ? { ok: false, fieldErrors: { coupon: state.message ?? "" } } : state;
  }
  const q = quote as { amount_cents: number; coupon: string | null };
  const { data: planRow } = await supabase.from("plans").select("name").eq("key", plan.data).single();

  let initPoint: string | null | undefined;
  try {
    const pre = await createPreapproval({
      reason: `Giroa · Plan ${planRow?.name ?? plan.data} ${cycle.data === "annual" ? "anual" : "mensual"} · ${studio.name}`,
      amountCents: q.amount_cents,
      frequencyMonths: cycle.data === "annual" ? 12 : 1,
      payerEmail: user.email,
      backUrl: studioUrl(slug, "/panel/plan?mp=ok"),
      ref: { studioId: studio.id, plan: plan.data, cycle: cycle.data, coupon: q.coupon },
    });
    initPoint = pre.init_point;
  } catch (e) {
    console.error("[subscribe]", e);
    return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  }
  if (!initPoint) return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  redirect(initPoint);
}

/** Cancelar la suscripción: sigue activa hasta el fin del período pagado. */
export async function cancelSubscription(slug: string): Promise<ActionState> {
  const { studio } = await requireOwner(slug, "/panel/plan");
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("studio_subscriptions")
    .select("mp_preapproval_id")
    .eq("studio_id", studio.id)
    .maybeSingle();
  if (!sub?.mp_preapproval_id) return { ok: false, message: "No tenés una suscripción activa." };

  try {
    await cancelPreapproval(sub.mp_preapproval_id);
  } catch (e) {
    console.error("[cancelSubscription]", e);
    return { ok: false, message: "No pudimos cancelar en Mercado Pago. Probá de nuevo en un rato." };
  }
  // El webhook también lo registra; acá lo dejamos asentado al toque.
  await admin
    .from("studio_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("studio_id", studio.id);
  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true, message: "Cancelaste tu suscripción. Podés seguir usando Giroa hasta el fin del período pagado." };
}
