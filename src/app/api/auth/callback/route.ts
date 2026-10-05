import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { platformUrl, safeNext } from "@/lib/urls";
import { publicEnv } from "@/lib/env";
import { resolveHost } from "@/lib/tenancy/host";

// Destino del magic link. Vive en /api para que el proxy no lo reescriba:
// así funciona igual en app.giroa.app y en el subdominio de cada estudio
// (la cookie del PKCE queda en el host donde se pidió el link).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = requestOrigin(request);
  const next = safeNext(params.get("next"), "/estudios");
  const supabase = await createClient();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  if (!ok) {
    // En el subdominio de un estudio, vuelve a su login (con su marca).
    const onStudio = resolveHost(new URL(origin).host, publicEnv().NEXT_PUBLIC_ROOT_DOMAIN).kind === "studio";
    const retry = `${onStudio ? "/ingresar" : "/login"}?error=link&next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(onStudio ? new URL(retry, origin) : platformUrl(retry));
  }
  return NextResponse.redirect(new URL(next, origin));
}

/**
 * Origen público del request (el host que pidió el navegador). request.url
 * puede traer el host interno del servidor, así que se arma desde los headers
 * y solo se acepta si es un host de Giroa; si no, se usa app.
 */
function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const target = resolveHost(host, publicEnv().NEXT_PUBLIC_ROOT_DOMAIN);
  if (host && (target.kind === "platform" || target.kind === "studio" || target.kind === "marketing")) {
    return `${proto}://${host}`;
  }
  return platformUrl("/");
}
