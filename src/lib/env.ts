import { z } from "zod";

// Variables públicas (llegan al navegador). Next solo las inyecta si se leen
// literalmente como process.env.NEXT_PUBLIC_..., por eso se arma el objeto a mano.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // giroa.app en producción, localhost:3000 en desarrollo (con puerto).
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(1),
  // .giroa.app en producción para compartir la sesión entre subdominios.
  NEXT_PUBLIC_COOKIE_DOMAIN: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  cached ??= publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
  });
  return cached;
}
