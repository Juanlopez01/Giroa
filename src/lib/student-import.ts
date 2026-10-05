import { parseCsv } from "@/lib/csv";

// Convierte una planilla de alumnos (como la tenga el estudio) en filas listas
// para import_students. Las columnas se reconocen por nombre, con variantes.

export type ImportRow = {
  /** Número de fila en el archivo (1 = primera fila de datos). */
  row: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  default_role: "leader" | "follower" | null;
  credits: number | null;
  unlimited: boolean;
  /** YYYY-MM-DD */
  expires_on: string | null;
};

export type ParsedImportRow = { row: number; data: ImportRow | null; errors: string[]; raw: Record<string, string> };

export type ImportParseResult =
  | { ok: true; columns: string[]; rows: ParsedImportRow[] }
  | { ok: false; error: string };

type Field = "full_name" | "first_name" | "last_name" | "email" | "phone" | "role" | "credits" | "expires_on";

const ALIASES: Record<string, Field> = {
  "nombre completo": "full_name",
  "nombre y apellido": "full_name",
  "apellido y nombre": "full_name",
  alumno: "full_name",
  alumna: "full_name",
  "alumno/a": "full_name",
  nombre: "first_name",
  apellido: "last_name",
  email: "email",
  "e-mail": "email",
  mail: "email",
  correo: "email",
  "correo electronico": "email",
  telefono: "phone",
  tel: "phone",
  celular: "phone",
  cel: "phone",
  whatsapp: "phone",
  rol: "role",
  clases: "credits",
  saldo: "credits",
  "clases restantes": "credits",
  "clases disponibles": "credits",
  creditos: "credits",
  vence: "expires_on",
  vencimiento: "expires_on",
  "fecha de vencimiento": "expires_on",
  vto: "expires_on",
};

export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRole(value: string): { ok: true; role: ImportRow["default_role"] } | { ok: false } {
  const v = normalizeHeader(value);
  if (!v) return { ok: true, role: null };
  if (["lider", "leader", "l", "guia"].includes(v)) return { ok: true, role: "leader" };
  if (["seguidor", "seguidora", "seguidor/a", "follower", "s"].includes(v)) return { ok: true, role: "follower" };
  return { ok: false };
}

/** dd/mm/aaaa, d/m/aa, dd-mm-aaaa o aaaa-mm-dd → aaaa-mm-dd. */
export function parseDate(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function parseStudentImport(text: string): ImportParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false, error: "El archivo tiene que tener una fila de títulos y al menos un alumno." };

  const headers = table[0] ?? [];
  const map = new Map<Field, number>();
  headers.forEach((h, i) => {
    const field = ALIASES[normalizeHeader(h)];
    if (field && !map.has(field)) map.set(field, i);
  });

  if (!map.has("full_name") && !map.has("first_name")) {
    return {
      ok: false,
      error: "No encontramos la columna del nombre. Poné un título como “Nombre” o “Nombre y apellido”.",
    };
  }

  const cell = (r: string[], f: Field) => {
    const i = map.get(f);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };

  const rows: ParsedImportRow[] = table.slice(1).map((r, idx) => {
    const errors: string[] = [];
    const raw = Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]));

    const fullName = (cell(r, "full_name") || `${cell(r, "first_name")} ${cell(r, "last_name")}`).replace(/\s+/g, " ").trim();
    if (!fullName) errors.push("Falta el nombre.");
    if (fullName.length > 120) errors.push("El nombre es muy largo.");

    const email = cell(r, "email").toLowerCase() || null;
    if (email && !EMAIL_RE.test(email)) errors.push("El email no es válido.");

    const role = parseRole(cell(r, "role"));
    if (!role.ok) errors.push("El rol tiene que ser líder o seguidor/a.");

    const creditsRaw = normalizeHeader(cell(r, "credits"));
    let credits: number | null = null;
    let unlimited = false;
    if (["libre", "ilimitado", "ilimitada", "libres"].includes(creditsRaw)) {
      unlimited = true;
    } else if (creditsRaw) {
      if (!/^\d+$/.test(creditsRaw) || Number(creditsRaw) > 1000) errors.push("Las clases tienen que ser un número (o “libre”).");
      else credits = Number(creditsRaw);
    }

    const expiresRaw = cell(r, "expires_on");
    const expiresOn = expiresRaw ? parseDate(expiresRaw) : null;
    if (expiresRaw && !expiresOn) errors.push("La fecha de vencimiento no se entiende (usá dd/mm/aaaa).");
    if ((unlimited || (credits ?? 0) > 0) && !expiresRaw) errors.push("Tiene saldo pero falta la fecha de vencimiento.");

    return {
      row: idx + 1,
      raw,
      errors,
      data: errors.length
        ? null
        : {
            row: idx + 1,
            full_name: fullName,
            email,
            phone: cell(r, "phone") || null,
            default_role: role.ok ? role.role : null,
            credits,
            unlimited,
            expires_on: expiresOn,
          },
    };
  });

  return { ok: true, columns: headers, rows };
}
