"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { packSchema, type PackInput } from "@/lib/validation/pack";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { studioOffersCouplePacks } from "@/lib/packs.server";
import { can } from "@/lib/gating";
import { parsePackRules, type PackRules } from "@/lib/pack-rules";

/** Restricciones del formulario (solo si el plan las incluye). Las clases tienen que ser del estudio. */
async function readRules(studioId: string, formData: FormData): Promise<{ rules: PackRules } | { error: string }> {
  if (!(await can(studioId, "pack_rules"))) return { rules: {} };
  const rules = parsePackRules({
    disciplines: formData.getAll("ruleDiscipline"),
    offerings: formData.getAll("ruleOffering"),
    weekdays: formData.getAll("ruleWeekday"),
    from: formData.get("ruleFrom") || undefined,
    until: formData.get("ruleUntil") || undefined,
  });
  if (rules.from && rules.until && rules.from >= rules.until) return { error: "El horario “desde” tiene que ser antes que el “hasta”." };
  if (rules.offerings?.length) {
    const supabase = await createClient();
    const { data } = await supabase.from("offerings").select("id").eq("studio_id", studioId).in("id", rules.offerings);
    rules.offerings = (data ?? []).map((o) => o.id);
    if (!rules.offerings.length) delete rules.offerings;
  }
  return { rules };
}

function readPack(formData: FormData) {
  return packSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    unlimited: formData.get("unlimited"),
    credits: formData.get("credits") || undefined,
    validityDays: formData.get("validityDays"),
    price: formData.get("price") ?? "",
    isCouple: formData.get("isCouple"),
  });
}

async function toRow(studioId: string, input: PackInput) {
  return {
    name: input.name,
    description: input.description,
    credits: input.unlimited ? null : (input.credits ?? null),
    validity_days: input.validityDays,
    price_cents: input.price,
    // Solo si el estudio da alguna disciplina con packs de pareja.
    is_couple: input.isCouple && (await studioOffersCouplePacks(studioId)),
  };
}

export async function createPack(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readPack(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const r = await readRules(studio.id, formData);
  if ("error" in r) return { ok: false, fieldErrors: { ruleFrom: r.error } };
  const { error } = await supabase.from("pack_products").insert({ ...(await toRow(studio.id, parsed.data)), rules: r.rules, studio_id: studio.id });
  if (error) return fromSupabaseError(error, "createPack");

  revalidatePath(`/s/${slug}/panel/packs`);
  redirect("/panel/packs?nuevo=1");
}

export async function updatePack(
  slug: string,
  packId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = readPack(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const r = await readRules(studio.id, formData);
  if ("error" in r) return { ok: false, fieldErrors: { ruleFrom: r.error } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pack_products")
    .update({ ...(await toRow(studio.id, parsed.data)), rules: r.rules })
    .eq("id", packId)
    .eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "updatePack");

  revalidatePath(`/s/${slug}/panel/packs`, "layout");
  return { ok: true, message: "Guardamos los cambios. Los packs que ya se vendieron no cambian." };
}

export async function setPackActive(slug: string, packId: string, active: boolean): Promise<void> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  await supabase.from("pack_products").update({ is_active: active }).eq("id", packId).eq("studio_id", studio.id);
  revalidatePath(`/s/${slug}/panel/packs`, "layout");
}
