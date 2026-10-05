"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validation/studio";
import { safeNext, platformUrl } from "@/lib/urls";
import type { ActionState } from "@/lib/errors";

export async function sendMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, fieldErrors: { email: parsed.error.issues[0]?.message ?? "Revisá el email." } };
  }
  const email = parsed.data;
  const next = safeNext(String(formData.get("next") ?? ""), "/estudios");

  // Next ya rechaza server actions cuyo Origin no coincide con el Host, así que
  // el origin es el de esta misma app (app. o el subdominio del estudio).
  const origin = (await headers()).get("origin");
  if (!origin) return { ok: false, message: "No pudimos mandar el link. Recargá la página y probá de nuevo." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { ok: false, message: "Ya te mandamos un link hace un ratito. Esperá un minuto y probá de nuevo." };
    }
    console.error("[sendMagicLink]", error);
    return { ok: false, message: "No pudimos mandar el link. Probá de nuevo en un rato." };
  }

  return {
    ok: true,
    message: `Listo: te mandamos un link a ${email}. Abrilo desde este mismo dispositivo para entrar.`,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(platformUrl("/login"));
}
