// Presente con el QR del estudio: el cartel lleva un link a la app del alumno.
// Lo usan el servidor (cartel, página del presente) y el escáner del alumno.

export const CHECKIN_PATH = "/app/presente";

const CODE_RE = /^[0-9a-f]{20}$/;

export function isCheckinCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

/** Path del presente con el código (relativo al subdominio del estudio). */
export function checkinPath(code: string): string {
  return `${CHECKIN_PATH}?c=${code}`;
}

/** Saca el código de lo que leyó la cámara: el link del cartel o el código solo. */
export function parseCheckinCode(data: string): string | null {
  const raw = data.trim();
  if (isCheckinCode(raw.toLowerCase())) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    if (!url.pathname.endsWith(CHECKIN_PATH)) return null;
    const code = url.searchParams.get("c")?.toLowerCase() ?? "";
    return isCheckinCode(code) ? code : null;
  } catch {
    return null;
  }
}

export type CheckinOption = {
  kind: "class" | "formation";
  session_id: string;
  title: string;
  starts_at: string;
  booked: boolean;
  attended: boolean;
};

export type CheckinResult =
  | (CheckinOption & { status: "checked_in" | "already" })
  | { status: "choose" | "walk_in"; options: CheckinOption[] };
