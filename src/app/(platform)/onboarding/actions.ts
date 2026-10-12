"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { parseReferrerSlug, REFERRAL_COOKIE } from "@/lib/studio-referrals";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { createStudioSchema, slugSchema } from "@/lib/validation/studio";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

export type SlugStatus = "available" | "invalid" | "reserved" | "taken" | "error";

export async function checkSlug(slug: string): Promise<SlugStatus> {
  if (!slugSchema.safeParse(slug).success) return "invalid";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_slug", { p_slug: slug });
  if (error) return "error";
  return data as SlugStatus;
}

export async function createStudio(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) {
    return { ok: false, message: "Tu sesión venció. Entrá de nuevo para seguir." };
  }

  const parsed = createStudioSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_studio", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error) {
    const state = fromSupabaseError(error, "createStudio");
    // Los errores de slug van debajo del campo.
    if (state.code?.startsWith("slug_") || state.code === "invalid_slug") {
      return { ok: false, fieldErrors: { slug: state.message ?? "" } };
    }
    return state;
  }

  await claimStudioReferral(data.id);
  redirect(`/onboarding/marca?estudio=${data.id}`);
}

/** Si llegó con el link de otro estudio ("Recomendá Giroa"), lo anota. Nunca frena el alta. */
async function claimStudioReferral(studioId: string) {
  const cookieStore = await cookies();
  const referrer = parseReferrerSlug(cookieStore.get(REFERRAL_COOKIE)?.value);
  if (!referrer) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_studio_referral", { p_studio_id: studioId, p_referrer_slug: referrer });
  if (error) console.warn("[createStudio] recomendación", error.message);

  const domain = publicEnv().NEXT_PUBLIC_COOKIE_DOMAIN;
  cookieStore.set(REFERRAL_COOKIE, "", { ...(domain ? { domain } : {}), path: "/", maxAge: 0 });
}
