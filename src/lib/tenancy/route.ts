import { isValidSlug, studioOrigin, type HostTarget } from "./host";

export type RouteDecision =
  | { type: "next" }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; url: string }
  | { type: "not_found" };

const STUDIO_PATH_RE = /^\/s\/([^/]+)(\/.*)?$/;

/**
 * Qué hacer con un request según el host ya resuelto.
 * - En el subdominio de un estudio, todo se sirve desde /s/{slug}/...
 * - /s/{slug}/... en otro host redirige al subdominio (una sola URL por página).
 * - /api/* nunca se reescribe: los handlers resuelven el estudio por su cuenta.
 */
export function decideRoute(
  target: HostTarget,
  pathname: string,
  search: string,
  rootDomain: string,
  protocol: string,
): RouteDecision {
  if (pathname === "/api" || pathname.startsWith("/api/")) return { type: "next" };

  switch (target.kind) {
    case "studio":
      return { type: "rewrite", pathname: `/s/${target.slug}${pathname === "/" ? "" : pathname}` };

    case "reserved":
      return { type: "not_found" };

    case "marketing":
    case "platform":
    case "unknown": {
      const match = STUDIO_PATH_RE.exec(pathname);
      if (match) {
        const slug = match[1] ?? "";
        if (!isValidSlug(slug)) return { type: "not_found" };
        return {
          type: "redirect",
          url: `${studioOrigin(slug, rootDomain, protocol)}${match[2] ?? "/"}${search}`,
        };
      }
      return { type: "next" };
    }
  }
}
