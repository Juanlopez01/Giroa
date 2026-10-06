import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signPayload } from "@/lib/crypto/signing";
import { serverEnv } from "@/lib/env.server";
import { authorizationUrl } from "@/lib/mp/api";
import { platformUrl } from "@/lib/urls";


// Inicia la vinculación de Mercado Pago. Solo owner/admin del estudio. El state
// va firmado (HMAC) con el estudio y el usuario, y vence en 10 minutos.
export async function GET(request: NextRequest) {
  const studioId = z.uuid().safeParse(request.nextUrl.searchParams.get("studio"));
  const user = await getCurrentUser();
  if (!studioId.success || !user) return NextResponse.redirect(platformUrl("/estudios"));

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("studio_members")
    .select("role, studios(slug)")
    .eq("studio_id", studioId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.redirect(platformUrl("/estudios"));
  }

  const state = signPayload({ studioId: studioId.data, userId: user.id }, serverEnv().OAUTH_STATE_SECRET, 600);
  return NextResponse.redirect(authorizationUrl(state, platformUrl("/api/mp/oauth/callback")));
}
