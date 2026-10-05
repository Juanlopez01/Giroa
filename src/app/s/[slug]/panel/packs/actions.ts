"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { packSchema, type PackInput } from "@/lib/validation/pack";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { studioOffersCouplePacks } from "@/lib/packs.server";

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
  const { error } = await supabase.from("pack_products").insert({ ...(await toRow(studio.id, parsed.data)), studio_id: studio.id });
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("pack_products")
    .update(await toRow(studio.id, parsed.data))
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
