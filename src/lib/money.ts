// Plata: en la base siempre centavos (bigint); en pantalla, pesos en formato
// argentino ("$ 29.900", "$ 1.250,50").

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const arsNoCents = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function formatArs(cents: number): string {
  return (cents % 100 === 0 ? arsNoCents : ars).format(cents / 100);
}

/**
 * Lee un monto escrito como en Argentina y devuelve centavos, o null si no se
 * entiende. Acepta "29900", "29.900", "29.900,50", "$ 1.250,5", "29900.5".
 */
export function parseArsToCents(input: string): number | null {
  const s = input.replace(/[\s$]/g, "");
  if (!s) return null;

  let normalized: string;
  if (s.includes(",")) {
    // "29.900,50": punto de miles y coma decimal.
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "29.900": solo puntos de miles.
    normalized = s.replace(/\./g, "");
  } else {
    normalized = s;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Centavos → texto editable en un input ("29.900" o "1.250,50"). */
export function centsToInput(cents: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  );
}
