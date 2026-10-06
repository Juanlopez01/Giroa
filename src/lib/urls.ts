import { publicEnv } from "@/lib/env";
import { resolveHost } from "@/lib/tenancy/host";

// En desarrollo (localhost o lvh.me) no hay HTTPS.
const DEV_ROOT_RE = /^(localhost|lvh\.me)(:\d+)?$/;

function protocol(rootDomain: string): string {
  return DEV_ROOT_RE.test(rootDomain) ? "http:" : "https:";
}

/** URL absoluta en app.giroa.com.ar (login, onboarding, elegir estudio). */
export function platformUrl(path = "/"): string {
  const root = publicEnv().NEXT_PUBLIC_ROOT_DOMAIN;
  return `${protocol(root)}//app.${root}${path}`;
}

/** URL absoluta en el subdominio del estudio. */
export function studioUrl(slug: string, path = "/"): string {
  const root = publicEnv().NEXT_PUBLIC_ROOT_DOMAIN;
  return `${protocol(root)}//${slug}.${root}${path}`;
}

/**
 * Valida un destino post-login. Acepta rutas relativas ("/onboarding") o URLs
 * absolutas de Giroa (app. o el subdominio de un estudio). Cualquier otra cosa
 * (otro dominio, "//evil.com", "javascript:") vuelve al default: así el login
 * no sirve como redirección abierta.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;

  const root = publicEnv().NEXT_PUBLIC_ROOT_DOMAIN;
  try {
    const url = new URL(next);
    if (url.protocol !== protocol(root)) return fallback;
    const target = resolveHost(url.host, root);
    if (target.kind === "platform" || target.kind === "studio" || target.kind === "marketing") return url.toString();
  } catch {
    // no es una URL
  }
  return fallback;
}
