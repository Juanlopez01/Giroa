import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Revisá el email: parece que tiene un error." }));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,40}$/, {
    error: "Usá entre 3 y 40 letras minúsculas, números o guiones.",
  })
  .refine((s) => !s.startsWith("-") && !s.endsWith("-"), {
    error: "No puede empezar ni terminar con guion.",
  });

export const createStudioSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre tiene que tener al menos 2 caracteres." })
    .max(80, { error: "El nombre puede tener hasta 80 caracteres." }),
  slug: slugSchema,
});

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
// Sin SVG: puede llevar scripts.
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const brandSchema = z.object({
  studioId: z.uuid(),
  brandColor: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, { error: "Elegí un color válido." }),
});
