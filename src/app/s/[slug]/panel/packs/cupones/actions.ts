"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { isYmd, startOfDay, addDaysYmd } from "@/lib/datetime";
import { parseArsToCents } from "@/lib/money";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,29}$/, { error: "Usá de 3 a 30 letras o números, sin espacios (ej.: PRIMAVERA20)." }),
    kind: z.enum(["percent", "amount"]),
    value: z.string().trim(),
    appliesTo: z.enum(["all", "packs", "events"]),
    maxUses: z.union([z.literal(""), z.coerce.number().int().min(1, { error: "Al menos 1." }).max(100000)]).transform((v) => (v === "" ? null : v)),
    oncePerPerson: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    validUntil: z.union([z.literal(""), z.string().refine(isYmd, { error: "Elegí una fecha válida." })]).transform((v) => (v === "" ? null : v)),
  })
  .transform((c, ctx) => {
    let value: number | null;
    if (c.kind === "percent") {
      const n = Number(c.value.replace(",", "."));
      value = Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
      if (value === null) ctx.addIssue({ code: "custom", path: ["value"], message: "Poné un porcentaje entero de 1 a 100." });
    } else {
      value = parseArsToCents(c.value);
      if (!value || value <= 0) {
        value = null;
        ctx.addIssue({ code: "custom", path: ["value"], message: "Poné el monto en pesos (ej.: 5.000)." });
      }
    }
    return { ...c, value: value ?? 0 };
  });

const refresh = (slug: string) => revalidatePath(`/s/${slug}/panel/packs/cupones`);

export async function createCoupon(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    kind: formData.get("kind"),
    value: formData.get("value") ?? "",
    appliesTo: formData.get("appliesTo"),
    maxUses: formData.get("maxUses") ?? "",
    oncePerPerson: formData.get("oncePerPerson"),
    validUntil: formData.get("validUntil") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const c = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").insert({
    studio_id: studio.id,
    code: c.code,
    kind: c.kind,
    value: c.value,
    applies_to: c.appliesTo,
    max_uses: c.maxUses,
    once_per_person: c.oncePerPerson,
    // "Vale hasta el 30/11" = hasta el final de ese día, hora del estudio.
    valid_until: c.validUntil ? startOfDay(addDaysYmd(c.validUntil, 1), studio.timezone).toISOString() : null,
  });
  if (error?.code === "23505") return { ok: false, fieldErrors: { code: "Ya tenés un código con ese nombre." } };
  if (error) return fromSupabaseError(error, "createCoupon");
  refresh(slug);
  return { ok: true, message: `Listo: ${c.code} ya se puede usar.` };
}

export async function setCouponActive(slug: string, couponId: string, active: boolean): Promise<void> {
  const { studio } = await requireAdmin(slug);
  if (!z.uuid().safeParse(couponId).success) return;
  const supabase = await createClient();
  await supabase.from("coupons").update({ is_active: active }).eq("id", couponId).eq("studio_id", studio.id);
  refresh(slug);
}
