// Parser de CSV chico y sin dependencias. Soporta comillas ("a, b" y ""),
// saltos de línea Windows/Unix, BOM y separador coma, punto y coma (lo que
// exporta Excel en Argentina) o tab. Detecta el separador en la primera línea.

const DELIMITERS = [",", ";", "\t"] as const;

function detectDelimiter(firstLine: string): string {
  let best: string = ",";
  let bestCount = -1;
  for (const d of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Saca filas totalmente vacías (típico al final de un Excel).
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------------------------------------------------------------------------
// Exportar para Excel en español: separador ";" (el Excel de Argentina usa la
// coma para los decimales), BOM para que abra bien los acentos, y CRLF.

export type CsvValue = string | number | boolean | null | undefined;

const BOM = String.fromCharCode(0xfeff);

function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "Sí" : "No") : String(v);
  // Evita que Excel interprete el texto como fórmula (inyección de CSV).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return BOM + [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

/** Plata en pesos con coma decimal: 1234550 → "12345,50". */
export function csvMoney(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
