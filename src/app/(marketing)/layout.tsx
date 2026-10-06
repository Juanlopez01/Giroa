import { Fraunces } from "next/font/google";
import Link from "next/link";
import { platformUrl } from "@/lib/urls";
import { GiroaLogo } from "@/components/brand/giroa-logo";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

// Identidad de Giroa (propuesta): bordó, arena, tinta, oro suave y salvia.
// Las pantallas de cada estudio usan la marca del estudio, no esta.
const giroaTheme = {
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

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} flex flex-1 flex-col bg-background text-foreground`} style={giroaTheme}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Giroa">
          <GiroaLogo />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#planes" className="hidden text-muted hover:text-foreground sm:inline">
            Planes
          </a>
          <a href="#fundadores" className="hidden text-muted hover:text-foreground sm:inline">
            Fundadores
          </a>
          <a href={platformUrl("/login")} className="font-medium text-brand">
            Entrar
          </a>
        </nav>
      </header>
      {children}
      <footer className="border-t border-border px-5 py-10 text-center text-sm text-muted">
        <div className="mb-3"><GiroaLogo className="text-[22px]" /></div>
        Hecho en Buenos Aires para estudios de danza y movimiento.
      </footer>
    </div>
  );
}
