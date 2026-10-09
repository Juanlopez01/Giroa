import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStudioAccessToken } from "@/lib/mp/connections";
import { cancelPreapproval } from "@/lib/mp/subscriptions";
import { fromSupabaseError, type ActionState } from "@/lib/errors";

/**
 * Baja de un abono (la pide el alumno o el estudio). Primero se cancela el
 * débito en MP, así nunca queda "dado de baja" acá mientras MP sigue cobrando;
 * después la RPC valida el permiso y lo marca. Lo pagado sigue valiendo.
 */
export async function cancelMembershipFor(studioId: string, subscriptionId: string): Promise<ActionState> {
  const supabase = await createClient();
  // RLS: solo lo ve el alumno dueño o el staff del estudio.
  const { data: sub } = await supabase
    .from("student_subscriptions")
    .select("id, status, mp_preapproval_id")
    .eq("id", subscriptionId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!sub) return { ok: false, message: "No encontramos ese abono." };
  if (sub.status === "cancelled") return { ok: true, message: "El abono ya estaba dado de baja." };

  if (sub.mp_preapproval_id) {
    try {
      const token = await getStudioAccessToken(studioId);
      if (!token) throw new Error("Sin Mercado Pago vinculado");
      await cancelPreapproval(sub.mp_preapproval_id, token);
    } catch (error) {
      console.error("[cancelMembership]", error);
      return { ok: false, message: "No pudimos dar de baja el débito en Mercado Pago. Probá de nuevo en un rato." };
    }
  }

  const { error } = await supabase.rpc("cancel_membership", { p_subscription_id: sub.id });
  if (error) return fromSupabaseError(error, "cancelMembership");
  return { ok: true, message: "Listo, el abono quedó dado de baja. No se te va a volver a cobrar." };
}
