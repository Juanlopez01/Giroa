import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { platformUrl } from "@/lib/urls";

export type CurrentUser = { id: string; email: string | null };

/** Usuario de la sesión, validando el JWT (no confía en la cookie sola). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/**
 * Exige sesión. Si no hay, manda al login y vuelve a `returnTo` después.
 * returnTo puede ser una ruta relativa o una URL absoluta de Giroa.
 */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(platformUrl(`/login?next=${encodeURIComponent(returnTo)}`));
  return user;
}
