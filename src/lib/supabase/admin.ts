import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente con service role: SALTEA RLS. Solo en el servidor y solo para lo
 * que no puede hacer el usuario: webhook de MP, tokens de MP, crons, emails.
 * Nunca lo uses para leer datos que después se muestran sin filtrar por estudio.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
