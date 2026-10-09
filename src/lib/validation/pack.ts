import { z } from "zod";
import { parseArsToCents } from "@/lib/money";

export const packSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { error: "Poné un nombre de al menos 2 caracteres." })
      .max(80, { error: "El nombre puede tener hasta 80 caracteres." }),
    description: z
      .string()
      .trim()
      .max(1000, { error: "La descripción es muy larga." })
      .transform((v) => (v === "" ? null : v)),
    unlimited: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    credits: z.coerce.number().int().optional(),
    validityDays: z.coerce
      .number({ error: "Poné la validez en días." })
      .int({ error: "Poné un número entero de días." })
      .min(1, { error: "La validez es de al menos 1 día." })
      .max(730, { error: "La validez puede ser de hasta 730 días." }),
    price: z.string().transform((v, ctx) => {
      const cents = parseArsToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Poné el precio en pesos (por ejemplo 29.900)." });
        return z.NEVER;
      }
      return cents;
    }),
    isCouple: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    isMembership: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  })
  .superRefine((p, ctx) => {
    if (!p.unlimited && (p.credits === undefined || p.credits < 1 || p.credits > 1000)) {
      ctx.addIssue({ code: "custom", path: ["credits"], message: "Poné cuántas clases incluye (de 1 a 1000)." });
    }
  });

export type PackInput = z.infer<typeof packSchema>;
