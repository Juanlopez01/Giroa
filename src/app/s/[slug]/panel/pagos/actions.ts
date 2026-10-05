"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { manualPaymentSchema } from "@/lib/validation/payment";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

// Todo el staff puede registrar cobros (muchas veces cobra el profe en la
// clase). La lista de pagos e ingresos es solo para owner/admin (RLS).
export async function registerPayment(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(slug);
  const parsed = manualPaymentSchema.safeParse({
    studentId: formData.get("studentId"),
    packProductId: formData.get("packProductId"),
    method: formData.get("method"),
    amount: formData.get("amount") ?? "",
    notes: formData.get("notes") ?? "",
    partnerStudentId: formData.get("partnerStudentId") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const p = parsed.data;

  // La RPC valida que alumno, pack y pareja sean de este estudio y que quien
  // llama sea staff; el monto por defecto es el precio del pack.
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_payment", {
    p_student_id: p.studentId,
    p_pack_product_id: p.packProductId,
    p_method: p.method,
    p_amount_cents: p.amount ?? undefined,
    p_notes: p.notes ?? undefined,
    p_partner_student_id: p.partnerStudentId ?? undefined,
  });
  if (error) {
    const state = fromSupabaseError(error, "registerPayment");
    if (state.code === "partner_not_found" || state.code === "not_couple_pack") {
      return { ok: false, fieldErrors: { partnerStudentId: state.message ?? "" } };
    }
    return state;
  }

  revalidatePath(`/s/${slug}/panel`, "layout");
  redirect(`/panel/alumnos/${p.studentId}?pago=1`);
}
