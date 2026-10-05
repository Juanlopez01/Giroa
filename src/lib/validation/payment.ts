import { z } from "zod";
import { parseArsToCents } from "@/lib/money";

export const manualPaymentSchema = z.object({
  studentId: z.uuid({ error: "Elegí un alumno." }),
  packProductId: z.uuid({ error: "Elegí un pack." }),
  method: z.enum(["cash", "transfer"], { error: "Elegí si fue en efectivo o por transferencia." }),
  // Vacío = el precio del pack.
  amount: z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const cents = parseArsToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Poné el monto en pesos (por ejemplo 29.900)." });
      return z.NEVER;
    }
    return cents;
  }),
  notes: z
    .string()
    .trim()
    .max(500, { error: "La nota puede tener hasta 500 caracteres." })
    .transform((v) => (v === "" ? null : v)),
  partnerStudentId: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
});
