import { z } from "zod";
import { isYmd } from "@/lib/datetime";
import { parseArsToCents } from "@/lib/money";

const checkbox = z.preprocess((v) => v === "on" || v === true, z.boolean());
const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, { error: message }).transform((v) => (v === "" ? null : v));
const ymd = (message: string) => z.string().refine(isYmd, { error: message });
const money = (message: string, allowZero: boolean) =>
  z.string().transform((v, ctx) => {
    const t = v.trim();
    if (t === "" || t === "0") {
      if (allowZero) return 0;
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    const cents = parseArsToCents(t);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

export const formationSchema = z
  .object({
    title: z.string().trim().min(2, { error: "Poné un nombre de al menos 2 caracteres." }).max(120),
    description: optionalText(6000, "La descripción es muy larga."),
    startsOn: ymd("Elegí la fecha de inicio."),
    endsOn: ymd("Elegí la fecha de fin."),
    capacity: z.union([z.literal(""), z.coerce.number().int().min(1, { error: "Al menos 1." }).max(10000)]).transform((v) => (v === "" ? null : v)),
    requiresApproval: checkbox,
    enrollmentFee: money("Poné la matrícula en pesos (0 si no tiene).", true),
    installmentsCount: z.coerce.number({ error: "Poné un número." }).int().min(0).max(36, { error: "Hasta 36 cuotas." }),
    installment: money("Poné el valor de la cuota en pesos.", true),
    firstDueOn: z.union([z.literal(""), ymd("Elegí una fecha válida.")]).transform((v) => (v === "" ? null : v)),
    fullPayment: money("Poné el pago total en pesos.", true),
    minAttendance: z.coerce.number({ error: "Poné un porcentaje." }).int().min(0).max(100, { error: "De 0 a 100." }),
  })
  .superRefine((f, ctx) => {
    if (f.endsOn < f.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "Termina antes de empezar." });
    if (f.installmentsCount > 0) {
      if (f.installment <= 0) ctx.addIssue({ code: "custom", path: ["installment"], message: "Poné el valor de la cuota." });
      if (!f.firstDueOn) ctx.addIssue({ code: "custom", path: ["firstDueOn"], message: "¿Cuándo vence la primera cuota?" });
    }
    if (f.fullPayment > 0 && f.installmentsCount > 0 && f.fullPayment >= f.installment * f.installmentsCount) {
      ctx.addIssue({ code: "custom", path: ["fullPayment"], message: "El pago total tiene que ser menor que la suma de las cuotas." });
    }
  });

export type FormationInput = z.infer<typeof formationSchema>;

export const formationSessionSchema = z.object({
  title: z.string().trim().min(2, { error: "Poné un nombre (ej.: Módulo 1: Técnica)." }).max(120),
  date: ymd("Elegí la fecha."),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Poné la hora." }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Poné la hora." }),
  location: optionalText(200, "El lugar es muy largo."),
  onlineUrl: z
    .union([z.literal(""), z.url({ protocol: /^https$/, error: "Pegá un link que empiece con https://" })])
    .transform((v) => (v === "" ? null : v)),
  teacherName: optionalText(120, "El nombre es muy largo."),
});

export const assessmentSchema = z.object({
  title: z.string().trim().min(2, { error: "Poné un nombre." }).max(120),
  kind: z.enum(["pass_fail", "grade"]),
  dueOn: z.union([z.literal(""), ymd("Elegí una fecha válida.")]).transform((v) => (v === "" ? null : v)),
});
