// Utilidades de color para la marca del estudio (sin dependencias).

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa (WCAG), de 0 (negro) a 1 (blanco). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#1c1917";

/** Texto que se lee sobre el color: blanco o casi negro, el de mejor contraste. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, LIGHT_TEXT) >= contrastRatio(hex, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** El color es demasiado claro para usarlo como acento sobre fondo claro (bordes, links, barras). */
export function isTooLight(hex: string): boolean {
  return contrastRatio(hex, "#fffdf9") < 3;
}

/** Oscurece un color multiplicando sus canales (0..1). */
export function darken(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `#${rgb.map((v) => Math.round(v * factor).toString(16).padStart(2, "0")).join("")}`;
}

/** Versión más oscura que ya se lee bien como acento (para sugerir si eligen uno muy claro). */
export function legibleVariant(hex: string): string {
  let out = hex;
  for (let i = 0; i < 12 && isTooLight(out); i++) out = darken(out, 0.85);
  return out;
}

/**
 * Variables CSS de la marca: el color sólido, el texto que va encima y tintes
 * suaves para fondos y bordes. Cualquier color queda sobrio.
 */
export function brandVars(hex: string): Record<string, string> {
  const accent = legibleVariant(hex);
  return {
    "--brand": accent,
    "--brand-foreground": readableOn(accent),
  };
}
