/** external_reference de MP para un cobro de formación: "formacion:<uuid>". */
export const FORMATION_REF_PREFIX = "formacion:";

export const ENROLLMENT_STATUS_LABEL = {
  applied: "Postulado/a",
  approved: "Aprobado/a · falta la matrícula",
  enrolled: "Inscripto/a",
  rejected: "No admitido/a",
  withdrawn: "De baja",
} as const;

export const CHARGE_KIND_LABEL = { enrollment: "Matrícula", installment: "Cuota", full: "Pago total" } as const;

/** "1/3/2027" desde un date de Postgres. */
export const fmtYmd = (ymd: string) => ymd.split("-").reverse().map(Number).join("/");

/** external_reference de MP para el arancel de una audición: "audicion:<uuid>". */
export const AUDITION_REF_PREFIX = "audicion:";

export const AUDITION_STATUS_LABEL = {
  pending_payment: "Falta pagar el arancel",
  submitted: "Inscripto/a",
  admitted: "Admitido/a",
  waitlisted: "Lista de espera",
  rejected: "No admitido/a",
  cancelled: "Cancelada",
} as const;
