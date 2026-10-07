import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type PublicStudio = {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  logo_path: string | null;
  timezone: string;
  cancel_window_hours: number;
  trial_class_enabled: boolean;
  cover_path: string | null;
};

/** Estudio por slug (lectura pública con RLS). Memoizado por request. */
export const getStudioBySlug = cache(async (slug: string): Promise<PublicStudio | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studios")
    .select("id, name, slug, brand_color, logo_path, timezone, cancel_window_hours, trial_class_enabled, cover_path")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

/** Ficha de alumno del usuario en el estudio, o null si todavía no se sumó. */
export const getMyStudent = cache(async (studioId: string, userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, full_name, email, phone, default_role, is_active, qr_token")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
});

/** Membresía del usuario en el estudio (rol, id y permiso de cobro), o null si no es staff. */
export const getMyMembership = cache(async (studioId: string, userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_members")
    .select("id, role, can_take_payments")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
});

/** Rol del usuario en el estudio, o null si no es staff. */
export async function getMyStaffRole(studioId: string, userId: string) {
  return (await getMyMembership(studioId, userId))?.role ?? null;
}

/** Equipo del estudio para elegir el profe de una clase (nombre o, si no tiene, el rol). */
export async function listTeamOptions(studioId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_members")
    .select("id, display_name, role")
    .eq("studio_id", studioId)
    .order("created_at");
  const roleName = { owner: "Dueño/a", admin: "Encargado/a", teacher: "Profe" } as const;
  return (data ?? []).map((m) => ({ id: m.id, name: m.display_name || `${roleName[m.role]} sin nombre` }));
}
