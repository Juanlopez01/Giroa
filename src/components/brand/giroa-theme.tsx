import { Fraunces } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

// Identidad de Giroa: bordó, arena, tinta, oro suave y salvia; títulos en
// Fraunces. Solo para las pantallas de Giroa (landing, login, onboarding):
// las de cada estudio usan la marca del estudio.
const GIROA_TOKENS = {
  "--background": "#f6f1ea",
  "--surface": "#fffdf9",
  "--foreground": "#1f1a17",
  "--muted": "#6f6259",
  "--border": "#e6dccf",
  "--brand": "#6b1f2e",
  "--brand-foreground": "#fffdf9",
  "--gold": "#c8a46b",
  "--success": "#5e7d6f",
} as React.CSSProperties;

export function GiroaTheme({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${fraunces.variable} flex flex-1 flex-col bg-background text-foreground ${className}`} style={GIROA_TOKENS}>
      {children}
    </div>
  );
}
