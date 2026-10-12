import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { resolveHost, type HostTarget } from "@/lib/tenancy/host";
import { decideRoute } from "@/lib/tenancy/route";
import { withSupabaseSession } from "@/lib/supabase/proxy";
import { parseReferrerSlug, REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE, REFERRAL_PARAM } from "@/lib/studio-referrals";

// Detecta el subdominio, reescribe a /s/[slug]/... y refresca la sesión.
// La autorización real está en RLS y en las RPC, no acá.
export async function proxy(request: NextRequest) {
  const { NEXT_PUBLIC_ROOT_DOMAIN: rootDomain } = publicEnv();
  const { pathname, search, protocol } = request.nextUrl;

  const target = resolveHost(request.headers.get("host"), rootDomain);
  const decision = decideRoute(target, pathname, search, rootDomain, protocol);

  switch (decision.type) {
    case "not_found":
      return new NextResponse(null, { status: 404 });
    case "redirect":
      return rememberReferrer(request, target, NextResponse.redirect(decision.url, 308));
    case "rewrite": {
      const url = request.nextUrl.clone();
      url.pathname = decision.pathname;
      return rememberReferrer(request, target, await withSupabaseSession(request, () => NextResponse.rewrite(url, { request })));
    }
    case "next":
      return rememberReferrer(request, target, await withSupabaseSession(request, () => NextResponse.next({ request })));
  }
}

// "Recomendá Giroa": quien llega a la landing con ?desde=<slug> queda anotado en
// una cookie que lee el onboarding (en app.giroa.com.ar, por eso va en el dominio
// raíz). Solo en la landing: en las páginas de los estudios ?desde= es la fecha
// de la grilla (?desde=2026-10-19) y no tiene que pisar la recomendación.
function rememberReferrer(request: NextRequest, target: HostTarget, response: NextResponse): NextResponse {
  if (target.kind !== "marketing") return response;
  const slug = parseReferrerSlug(request.nextUrl.searchParams.get(REFERRAL_PARAM));
  if (!slug) return response;
  const domain = publicEnv().NEXT_PUBLIC_COOKIE_DOMAIN;
  response.cookies.set(REFERRAL_COOKIE, slug, {
    ...(domain ? { domain } : {}),
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes optimizadas.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
