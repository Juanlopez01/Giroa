import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";

// "Cobrar" en el panel: lo que un alumno tiene pendiente de pago, para cobrarlo
// en el mostrador con un toque. Cada tipo se paga con su RPC de siempre.

export type PendingKind = "formation" | "class" | "audition";

export type PendingCharge = {
  kind: PendingKind;
  id: string;
  title: string;
  detail: string;
  amountCents: number;
};

const CHARGE_LABEL = { enrollment: "Matrícula", installment: "Cuota", full: "Pago total" } as const;

export async function pendingCharges(studioId: string, studentId: string, timeZone: string): Promise<PendingCharge[]> {
  const supabase = await createClient();
  const [{ data: charges }, { data: classes }, { data: auditions }] = await Promise.all([
    supabase
      .from("formation_charges")
      .select(
        "id, kind, number, amount_cents, due_on, formations!formation_charges_studio_id_formation_id_fkey(title), formation_enrollments!formation_charges_studio_id_enrollment_id_fkey!inner(student_id)",
      )
      .eq("studio_id", studioId)
      .eq("status", "pending")
      .eq("formation_enrollments.student_id", studentId)
      .order("due_on"),
    supabase
      .from("class_purchases")
      .select("id, amount_cents, sessions!class_purchases_studio_id_session_id_fkey(starts_at, offerings(title))")
      .eq("studio_id", studioId)
      .eq("student_id", studentId)
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("audition_applications")
      .select("id, fee_cents, auditions!audition_applications_studio_id_audition_id_fkey(title)")
      .eq("studio_id", studioId)
      .eq("student_id", studentId)
      .eq("status", "pending_payment")
      .gt("fee_cents", 0),
  ]);

  const shortDate = (ymd: string) => {
    const [, m, d] = ymd.split("-").map(Number);
    return `${d}/${m}`;
  };

  return [
    ...(charges ?? []).map((c) => ({
      kind: "formation" as const,
      id: c.id,
      title: `${CHARGE_LABEL[c.kind]}${c.kind === "installment" ? ` ${c.number}` : ""} · ${c.formations?.title ?? "Formación"}`,
      detail: `Vence el ${shortDate(c.due_on)}`,
      amountCents: c.amount_cents,
    })),
    ...(classes ?? []).map((c) => ({
      kind: "class" as const,
      id: c.id,
      title: c.sessions?.offerings?.title ?? "Clase",
      detail: c.sessions
        ? `Clase reservada sin pagar · ${formatDayLabel(toYmd(new Date(c.sessions.starts_at), timeZone))} ${formatTime(c.sessions.starts_at, timeZone)}`
        : "Clase reservada sin pagar",
      amountCents: c.amount_cents,
    })),
    ...(auditions ?? []).map((a) => ({
      kind: "audition" as const,
      id: a.id,
      title: `Arancel · ${a.auditions?.title ?? "Audición"}`,
      detail: "Audición sin pagar",
      amountCents: a.fee_cents,
    })),
  ];
}
