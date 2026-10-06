import type { CookieOptionsWithName } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// En producción la cookie de sesión vive en .giroa.com.ar: el login en
// app.giroa.com.ar sirve también en {slug}.giroa.com.ar.
export function sessionCookieOptions(): CookieOptionsWithName {
  const domain = publicEnv().NEXT_PUBLIC_COOKIE_DOMAIN;
  return domain ? { domain } : {};
}
