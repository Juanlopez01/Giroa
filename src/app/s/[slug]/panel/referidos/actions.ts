"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";

/** Cuántas clases se regalan a cada uno (0 = apagado). */
export async function setReferralCredits(slug: string, formData: FormData): Promise<void> {
  const { studio } = await requireAdmin(slug, "/panel/referidos");
  const parsed = z.coerce.number().int().min(0).max(10).safeParse(formData.get("credits"));
  if (!parsed.success) redirect("/panel/referidos");
  const supabase = await createClient();
  const { error } = await supabase.from("studios").update({ referral_credits: parsed.data }).eq("id", studio.id);
  if (error) console.error("[setReferralCredits]", error);
  revalidatePath(`/s/${slug}`, "layout");
  redirect("/panel/referidos?ok=1");
}
