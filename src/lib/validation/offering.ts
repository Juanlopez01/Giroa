import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const offeringSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, { error: "Poné un nombre de al menos 2 caracteres." })
      .max(120, { error: "El nombre puede tener hasta 120 caracteres." }),
    disciplineKey: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, { error: "Elegí una disciplina." }),
    level: optionalText(60, "El nivel puede tener hasta 60 caracteres."),
    teacherName: optionalText(120, "El nombre del profe puede tener hasta 120 caracteres."),
    teacherMemberId: z
      .union([z.literal(""), z.uuid()])
      .optional()
      .transform((v) => (v ? v : null)),
    description: optionalText(4000, "La descripción es muy larga."),
    capacity: z.coerce
      .number({ error: "Poné un número." })
      .int({ error: "Poné un número entero." })
      .min(1, { error: "El cupo tiene que ser al menos 1." })
      .max(1000, { error: "El cupo puede ser hasta 1000." }),
    roleBalance: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    roleBalanceMaxDiff: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine((o) => !o.roleBalance || o.roleBalanceMaxDiff !== undefined, {
    path: ["roleBalanceMaxDiff"],
    error: "Poné la diferencia máxima (1 o más).",
  });

export type OfferingInput = z.infer<typeof offeringSchema>;

export const scheduleSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6, { error: "Elegí un día." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Poné la hora (por ejemplo 19:30)." }),
  durationMinutes: z.coerce
    .number({ error: "Poné la duración en minutos." })
    .int()
    .min(15, { error: "La clase dura al menos 15 minutos." })
    .max(600, { error: "La clase puede durar hasta 10 horas." }),
});
