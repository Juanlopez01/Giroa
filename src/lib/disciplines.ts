import type { Json } from "@/types/database";

// Flags de comportamiento de una disciplina (disciplines.features). La interfaz
// muestra u oculta funciones según estos flags; nunca según el nombre.
export type DisciplineFeatures = {
  role_balance: boolean;
  couple_packs: boolean;
  equipment_capacity: boolean;
  levels: boolean;
};

export function parseFeatures(features: Json | null | undefined): DisciplineFeatures {
  const f = features && typeof features === "object" && !Array.isArray(features) ? features : {};
  const flag = (k: string) => f[k] === true;
  return {
    role_balance: flag("role_balance"),
    couple_packs: flag("couple_packs"),
    equipment_capacity: flag("equipment_capacity"),
    levels: flag("levels"),
  };
}

export type DisciplineOption = { key: string; name: string; features: DisciplineFeatures };

export const ROLE_LABELS = { leader: "Líder", follower: "Seguidor/a" } as const;
