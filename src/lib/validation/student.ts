import { z } from "zod";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const studentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "Poné el nombre." })
    .max(120, { error: "El nombre puede tener hasta 120 caracteres." }),
  email: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: "Revisá el email." }))
      .nullable(),
  ),
  phone: z.preprocess(blankToNull, z.string().trim().max(40, { error: "El teléfono es muy largo." }).nullable()),
  defaultRole: z.preprocess(blankToNull, z.enum(["leader", "follower"]).nullable()),
});

export const importRowSchema = z.object({
  row: z.number().int().min(1),
  full_name: z.string().trim().min(1).max(120),
  email: z.email().nullable(),
  phone: z.string().max(40).nullable(),
  default_role: z.enum(["leader", "follower"]).nullable(),
  credits: z.number().int().min(0).max(1000).nullable(),
  unlimited: z.boolean(),
  expires_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const importPayloadSchema = z.array(importRowSchema).min(1).max(2000);
