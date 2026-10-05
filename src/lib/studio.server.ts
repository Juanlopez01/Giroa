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
};

/** Estudio por slug (lectura pública con RLS). Memoizado por request. */
export const getStudioBySlug = cache(async (slug: string): Promise<PublicStudio | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studios")
    .select("id, name, slug, brand_color, logo_path, timezone")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

/** Rol del usuario en el estudio, o null si no es staff. */
export const getMyStaffRole = cache(async (studioId: string, userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_members")
    .select("role")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
});
