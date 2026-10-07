import { publicEnv } from "@/lib/env";

/** URL pública del logo (bucket studio-assets es público). */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/studio-assets/${path}`;
}

/** URL pública de un archivo del estudio (logo o portada). */
export const assetUrl = logoUrl;

/** Paletas curadas por disciplina: colores que se ven sobrios como acento. */
export const BRAND_PALETTES = [
  { name: "Tango y teatro", colors: [{ hex: "#6b1f2e", label: "Borgoña" }, { hex: "#a8482b", label: "Terracota" }, { hex: "#2b2b2e", label: "Carbón" }] },
  { name: "Yoga y bienestar", colors: [{ hex: "#5f7a61", label: "Salvia" }, { hex: "#9a5b3f", label: "Arcilla" }, { hex: "#7d6b55", label: "Lino" }] },
  { name: "Pilates y entrenamiento", colors: [{ hex: "#1f5a6b", label: "Petróleo" }, { hex: "#3d4248", label: "Grafito" }, { hex: "#a5741f", label: "Ocre" }] },
  { name: "Danza y ballet", colors: [{ hex: "#a8636e", label: "Rosa empolvado" }, { hex: "#8c6a5d", label: "Nude" }, { hex: "#475569", label: "Pizarra" }] },
] as const;
