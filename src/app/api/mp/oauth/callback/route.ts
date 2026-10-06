import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { verifyPayload } from "@/lib/crypto/signing";
import { serverEnv } from "@/lib/env.server";
import { exchangeCode } from "@/lib/mp/api";
import { saveConnection } from "@/lib/mp/connections";
import { platformUrl, studioUrl } from "@/lib/urls";

// Vuelta del OAuth de Mercado Pago. Valida el state firmado, que quien vuelve
// sea el mismo usuario que inició y que siga siendo owner/admin; recién ahí
// cambia el code por tokens y los guarda encriptados.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = verifyPayload<{ studioId: string; userId: string }>(
    params.get("state") ?? "",
    serverEnv().OAUTH_STATE_SECRET,
  );
  if (!state) return NextResponse.redirect(platformUrl("/estudios?mp=state"));

  const user = await getCurrentUser();
  if (!user || user.id !== state.userId) return NextResponse.redirect(platformUrl("/estudios?mp=state"));

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("studio_members")
    .select("role, studios(slug)")
    .eq("studio_id", state.studioId)
    .eq("user_id", user.id)
    .maybeSingle();
  const slug = member?.studios?.slug;
  if (!member || !slug || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.redirect(platformUrl("/estudios"));
  }

  const code = params.get("code");
  if (!code) return NextResponse.redirect(studioUrl(slug, "/panel/ajustes?mp=cancelado"));

  try {
    const tokens = await exchangeCode(code, platformUrl("/api/mp/oauth/callback"));
    await saveConnection(state.studioId, tokens, user.id);
  } catch (error) {
    console.error("[mp oauth callback]", error);
    return NextResponse.redirect(studioUrl(slug, "/panel/ajustes?mp=error"));
  }

  return NextResponse.redirect(studioUrl(slug, "/panel/ajustes?mp=ok"));
}
