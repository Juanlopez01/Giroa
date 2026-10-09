// Avatar con iniciales: lo usan la app del alumno y el panel (misma línea visual).

/** "Martina Sosa" → "MS"; "nadia" → "N". */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

const SIZES = { sm: "h-9 w-9 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 font-serif text-2xl" } as const;
const TONES = {
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  muted: "bg-border/60 text-muted",
} as const;

export function Avatar({
  name,
  size = "md",
  tone = "brand",
  online = false,
}: {
  name: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  /** Punto verde: usa la app. */
  online?: boolean;
}) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${TONES[tone]}`}>
      {initials(name)}
      {online ? (
        <span
          title="Usa la app"
          className={`absolute right-0 bottom-0 rounded-full bg-success ring-2 ring-surface ${size === "lg" ? "h-4 w-4" : "h-3 w-3"}`}
        />
      ) : null}
    </span>
  );
}
