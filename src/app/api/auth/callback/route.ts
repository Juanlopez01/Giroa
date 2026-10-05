import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/urls";

// Destino del magic link. Vive en /api para que el proxy no lo reescriba:
// así funciona igual en app.giroa.app y en el subdominio de cada estudio
// (la cookie del PKCE queda en el host donde se pidió el link).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
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
    return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
