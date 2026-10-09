"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseError, type ActionState } from "@/lib/errors";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { createMembershipPreapproval } from "@/lib/mp/memberships";
import { cancelMembershipFor } from "@/lib/memberships.server";
import { studioUrl } from "@/lib/urls";

/**
 * Abonarse a un pack:
 *  1. start_membership (RPC, como el alumno) crea el abono pendiente con el precio del pack,
 *  2. se crea el débito automático en MP con el token del estudio,
 *  3. se redirige a MP para que el alumno lo autorice. El webhook carga cada mes.
 */
export async function startMembership(slug: string, packProductId: string): Promise<ActionState> {
  const { studio, user } = await requireStudent(slug, "/app/packs");
  if (!z.uuid().safeParse(packProductId).success) return { ok: false, message: "Este abono ya no está disponible." };
  if (!user.email) return { ok: false, message: "Tu cuenta no tiene email. Hablá con el estudio." };

  const supabase = await createClient();
  const { data: sub, error } = await supabase.rpc("start_membership", { p_pack_product_id: packProductId });
  if (error) return fromSupabaseError(error, "startMembership");

  let initPoint: string;
  try {
    const token = await getStudioAccessToken(studio.id);
    if (!token) return { ok: false, message: "Este estudio todavía no cobra online. Consultá en el estudio cómo pagar." };
    const pre = await createMembershipPreapproval(token, {
      subscriptionId: sub.id,
      reason: `Abono ${sub.name} · ${studio.name}`,
      amountCents: sub.amount_cents,
      payerEmail: user.email,
      backUrl: studioUrl(slug, "/app/perfil/abono"),
    });
    if (!pre.init_point) throw new Error("MP no devolvió init_point");
    const { error: linkError } = await createAdminClient().rpc("mp_link_membership", {
      p_subscription_id: sub.id,
      p_preapproval_id: pre.id,
    });
    if (linkError) throw linkError;
    initPoint = pre.init_point;
  } catch (e) {
    console.error("[startMembership]", e);
    return { ok: false, message: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato." };
  }

  redirect(initPoint);
}

export async function cancelMyMembership(slug: string, subscriptionId: string): Promise<ActionState> {
  const { studio } = await requireStudent(slug, "/app/perfil/abono");
  if (!z.uuid().safeParse(subscriptionId).success) return { ok: false, message: "No encontramos ese abono." };
  const result = await cancelMembershipFor(studio.id, subscriptionId);
  revalidatePath(`/s/${slug}/app`, "layout");
  return result;
}
