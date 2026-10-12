import "server-only";
import { createClient } from "@/lib/supabase/server";
import { LIBRARY_BUCKET } from "@/lib/materials";
import type { MaterialRow } from "@/components/formations/material-list";

export type LibraryRow = MaterialRow & { audience: "all" | "pack" };

/** Ítems de la biblioteca que el usuario puede ver (RLS), con URLs firmadas de 10 minutos. */
export async function listLibrary(studioId: string): Promise<LibraryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("library_items")
    .select("id, title, description, kind, url, storage_path, mime_type, size_bytes, audience")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false });
  const paths = (data ?? []).flatMap((m) => (m.storage_path ? [m.storage_path] : []));
  const { data: signed } = paths.length ? await supabase.storage.from(LIBRARY_BUCKET).createSignedUrls(paths, 600) : { data: [] };
  const urlByPath = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return (data ?? []).map((m) => ({
    ...m,
    session_id: null,
    audience: m.audience === "pack" ? "pack" : "all",
    href: m.kind === "link" ? m.url : m.storage_path ? (urlByPath.get(m.storage_path) ?? null) : null,
  }));
}
