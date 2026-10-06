import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { refreshTokens, type MpTokens } from "./api";

// mp_connections no tiene políticas RLS: solo se toca con service role, acá.

const REFRESH_BEFORE_MS = 7 * 24 * 3_600_000;

export async function saveConnection(studioId: string, tokens: MpTokens, connectedBy: string | null): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("mp_connections").upsert({
    studio_id: studioId,
    mp_user_id: tokens.user_id,
    access_token_enc: await encryptToken(tokens.access_token, studioId),
    refresh_token_enc: await encryptToken(tokens.refresh_token, studioId),
    public_key: tokens.public_key ?? null,
    live_mode: tokens.live_mode ?? true,
    scope: tokens.scope ?? null,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    ...(connectedBy ? { connected_by: connectedBy } : {}),
  });
  if (error) throw error;
}

/**
 * Access token vigente del estudio. Si vence en menos de 7 días, lo renueva
 * con el refresh token y guarda el par nuevo. null si el estudio no vinculó MP.
 */
export async function getStudioAccessToken(studioId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("mp_connections").select("*").eq("studio_id", studioId).maybeSingle();
  if (!data) return null;

  if (new Date(data.expires_at).getTime() - Date.now() > REFRESH_BEFORE_MS) {
    return decryptToken(data.access_token_enc, studioId);
  }

  const refreshed = await refreshTokens(await decryptToken(data.refresh_token_enc, studioId));
  await saveConnection(studioId, refreshed, null);
  return refreshed.access_token;
}

export async function deleteConnection(studioId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("mp_connections").delete().eq("studio_id", studioId);
}
