import { z } from "zod";
import { isYmd } from "@/lib/datetime";
import { parseArsToCents } from "@/lib/money";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((v) => (v === "" ? null : v));
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Poné la hora (por ejemplo 21:30)." });

export const eventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, { error: "Poné un nombre de al menos 2 caracteres." })
      .max(120, { error: "El nombre puede tener hasta 120 caracteres." }),
    description: optionalText(4000, "La descripción es muy larga."),
    venue: optionalText(200, "El lugar puede tener hasta 200 caracteres."),
    date: z.string().refine(isYmd, { error: "Elegí la fecha." }),
    startTime: hhmm,
    endTime: z.union([z.literal(""), hhmm]).transform((v) => (v === "" ? null : v)),
  })
  .superRefine((e, ctx) => {
    if (e.endTime && e.endTime === e.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "La hora de fin tiene que ser distinta a la de inicio." });
    }
  });

export type EventInput = z.infer<typeof eventSchema>;

export const ticketTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Poné un nombre (por ejemplo Anticipada)." })
    .max(60, { error: "El nombre puede tener hasta 60 caracteres." }),
  price: z.string().transform((v, ctx) => {
    if (v.trim() === "" || v.trim() === "0") return 0;
    const cents = parseArsToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Poné el precio en pesos (0 si es gratis)." });
      return z.NEVER;
    }
    return cents;
  }),
  quantity: z
    .union([z.literal(""), z.coerce.number().int().min(1, { error: "El cupo es de al menos 1." }).max(100000)])
    .transform((v) => (v === "" ? null : v)),
  maxPerOrder: z.coerce
    .number({ error: "Poné un número." })
    .int()
    .min(1, { error: "Al menos 1 por compra." })
    .max(20, { error: "Hasta 20 por compra." }),
  salesEndDate: z
    .union([z.literal(""), z.string().refine(isYmd, { error: "Elegí una fecha válida." })])
    .transform((v) => (v === "" ? null : v)),
});

export type TicketTypeInput = z.infer<typeof ticketTypeSchema>;

export const buyTicketsSchema = z.object({
  ticketTypeId: z.uuid({ error: "Elegí una entrada." }),
  quantity: z.coerce.number().int().min(1).max(20),
  name: z
    .string()
    .trim()
    .min(2, { error: "Poné tu nombre y apellido." })
    .max(120, { error: "El nombre es muy largo." }),
  email: z.email({ error: "Revisá el email: ahí te mandamos las entradas." }).trim().toLowerCase(),
  phone: optionalText(40, "El teléfono es muy largo."),
});

export const manualSaleSchema = z.object({
  ticketTypeId: z.uuid({ error: "Elegí una entrada." }),
  quantity: z.coerce.number({ error: "Poné la cantidad." }).int().min(1, { error: "Al menos 1." }).max(20, { error: "Hasta 20 por vez." }),
  name: z
    .string()
    .trim()
    .min(2, { error: "Poné el nombre de quien compra." })
    .max(120, { error: "El nombre es muy largo." }),
  email: z
    .union([z.literal(""), z.email({ error: "Revisá el email." })])
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  method: z.enum(["cash", "transfer"], { error: "Elegí efectivo o transferencia." }),
});
