import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { resolveHost } from "@/lib/tenancy/host";
import { decideRoute } from "@/lib/tenancy/route";
import { withSupabaseSession } from "@/lib/supabase/proxy";

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
      return NextResponse.redirect(decision.url, 308);
    case "rewrite": {
      const url = request.nextUrl.clone();
      url.pathname = decision.pathname;
      return withSupabaseSession(request, () => NextResponse.rewrite(url, { request }));
    }
    case "next":
      return withSupabaseSession(request, () => NextResponse.next({ request }));
  }
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes optimizadas.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
