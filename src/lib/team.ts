// Roles del equipo del estudio (compartido entre servidor y cliente).
export const ROLE_INFO = {
  owner: { label: "Dueño", detail: "Todo, incluida la suscripción a Giroa." },
  admin: { label: "Encargado", detail: "Todo el panel menos la suscripción." },
  teacher: { label: "Profe", detail: "Agenda, asistencia, alumnos y puerta de eventos." },
} as const;
