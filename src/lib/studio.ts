import { publicEnv } from "@/lib/env";

/** URL pública del logo (bucket studio-assets es público). */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/studio-assets/${path}`;
}

/** Colores sugeridos para la marca del estudio en el onboarding. */
export const BRAND_PRESETS = ["#7a2e3a", "#b4532a", "#2f5d50", "#1f4e79", "#5b3f8c", "#1c1917"] as const;
