// Abonos mensuales (student_subscriptions): textos para la app y el panel.

export type MembershipStatus = "pending" | "active" | "past_due" | "cancelled";

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  pending: "Esperando la autorización",
  active: "Al día",
  past_due: "Cobro rechazado",
  cancelled: "Dado de baja",
};

// status_detail de MP → motivo entendible.
const CHARGE_ERRORS: Record<string, string> = {
  cc_rejected_insufficient_amount: "Fondos insuficientes",
  cc_rejected_card_disabled: "La tarjeta está deshabilitada",
  cc_rejected_bad_filled_date: "La tarjeta está vencida",
  cc_rejected_card_error: "La tarjeta rechazó el cobro",
  cc_rejected_call_for_authorize: "El banco pide autorizar el cobro",
  cc_rejected_high_risk: "Mercado Pago rechazó el cobro",
  cc_rejected_max_attempts: "Demasiados intentos con la tarjeta",
};

export function membershipChargeError(statusDetail: string | null | undefined): string {
  return (statusDetail && CHARGE_ERRORS[statusDetail]) || "Cobro rechazado";
}

/** "Se cobra el 12/11" · "Se renueva hoy". */
export function nextChargeLabel(nextChargeAt: string | null, timeZone: string, now = new Date()): string | null {
  if (!nextChargeAt) return null;
  const fmt = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone, day: "numeric", month: "numeric" }).format(d);
  const next = new Date(nextChargeAt);
  return fmt(next) === fmt(now) ? "Se cobra hoy" : `Se cobra el ${fmt(next)}`;
}
