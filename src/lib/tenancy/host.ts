// Resolución del host → qué parte de Giroa se sirve. Función pura (sin Next)
// para poder testearla.
//
//   giroa.com.ar, www.giroa.com.ar   → landing (marketing)
//   app.giroa.com.ar              → login, onboarding, elegir estudio (platform)
//   api., admin.               → reservados
//   {slug}.giroa.com.ar           → estudio: se reescribe a /s/{slug}/...
//   cualquier otro host        → unknown (dominio propio del plan Pro, Fase 3)

export const RESERVED_SUBDOMAINS = ["www", "app", "api", "admin"] as const;

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

export type HostTarget =
  | { kind: "marketing" }
  | { kind: "platform" }
  | { kind: "reserved"; subdomain: string }
  | { kind: "studio"; slug: string }
  | { kind: "unknown"; host: string };

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !slug.startsWith("-") && !slug.endsWith("-");
}

/**
 * @param host       valor del header Host (puede traer puerto)
 * @param rootDomain dominio raíz con puerto si corresponde ("giroa.com.ar", "localhost:3000")
 */
export function resolveHost(host: string | null, rootDomain: string): HostTarget {
  const h = (host ?? "").trim().toLowerCase();
  const root = rootDomain.trim().toLowerCase();

  if (!h || h === root || h === `www.${root}`) return { kind: "marketing" };
  if (h === `app.${root}`) return { kind: "platform" };

  if (h.endsWith(`.${root}`)) {
    const sub = h.slice(0, -(root.length + 1));
    if ((RESERVED_SUBDOMAINS as readonly string[]).includes(sub)) {
      return { kind: "reserved", subdomain: sub };
    }
    if (isValidSlug(sub)) return { kind: "studio", slug: sub };
    return { kind: "unknown", host: h };
  }

  return { kind: "unknown", host: h };
}

/** URL pública del estudio, p. ej. https://tango-sur.giroa.com.ar */
export function studioOrigin(slug: string, rootDomain: string, protocol = "https:"): string {
  return `${protocol}//${slug}.${rootDomain}`;
}
