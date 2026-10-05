import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import { sessionCookieOptions } from "./cookies";

/**
 * Refresca la sesión de Supabase en el proxy y devuelve la respuesta (next o
 * rewrite) con las cookies actualizadas.
 *
 * @param makeResponse arma la respuesta base; se vuelve a llamar si Supabase
 *                     actualiza cookies, para que el request reescrito las vea.
 */
export async function withSupabaseSession(
  request: NextRequest,
  makeResponse: () => NextResponse,
): Promise<NextResponse> {
  const env = publicEnv();
  let response = makeResponse();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = makeResponse();
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Valida el JWT y refresca el token si venció. No usar getSession() acá.
  await supabase.auth.getClaims();

  return response;
}
