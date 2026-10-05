import type { CookieOptionsWithName } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// En producción la cookie de sesión vive en .giroa.app: el login en
// app.giroa.app sirve también en {slug}.giroa.app.
export function sessionCookieOptions(): CookieOptionsWithName {
  const domain = publicEnv().NEXT_PUBLIC_COOKIE_DOMAIN;
  return domain ? { domain } : {};
}
