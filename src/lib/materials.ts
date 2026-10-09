// Material de formaciones: reglas compartidas entre el navegador (subida) y el
// servidor (validación). Lo mismo que permite el bucket formation-materials.

export const MATERIALS_BUCKET = "formation-materials";
export const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;
export const MATERIAL_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
] as const;
export const MATERIAL_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.aac,.wav,.ogg";

/** Nombre de archivo seguro para la ruta: sin acentos ni espacios. */
export function safeFileName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (clean || "archivo").slice(-80);
}

/** Ruta en el bucket: <studio>/<formación>/<timestamp>-<nombre>. */
export function materialPath(studioId: string, formationId: string, fileName: string, now = Date.now()): string {
  return `${studioId}/${formationId}/${now}-${safeFileName(fileName)}`;
}

export function isMaterialPath(studioId: string, formationId: string, path: unknown): path is string {
  return typeof path === "string" && new RegExp(`^${studioId}/${formationId}/\\d{10,16}-[a-z0-9._-]{1,80}$`).test(path);
}

export type MaterialKind = "pdf" | "image" | "audio" | "link";

export function materialKind(m: { kind: string; mime_type: string | null }): MaterialKind {
  if (m.kind === "link") return "link";
  if (m.mime_type?.startsWith("image/")) return "image";
  if (m.mime_type?.startsWith("audio/")) return "audio";
  return "pdf";
}

/** "2,4 MB" */
export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}
