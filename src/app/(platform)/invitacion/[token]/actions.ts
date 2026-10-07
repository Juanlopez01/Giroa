"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fromSupabaseError, type ActionState } from "@/lib/errors";
import { studioUrl } from "@/lib/urls";

export async function acceptInvite(token: string): Promise<ActionState> {
  await requireUser(`/invitacion/${token}`);
  if (!/^[0-9a-f]{32}$/.test(token)) return { ok: false, message: "Esta invitación no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return fromSupabaseError(error, "acceptInvite");

  const slug = (data as { slug: string }).slug;
  redirect(studioUrl(slug, "/panel?bienvenida=equipo"));
}
