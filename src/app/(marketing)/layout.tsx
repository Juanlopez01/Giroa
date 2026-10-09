import Link from "next/link";
import { platformUrl } from "@/lib/urls";
import { GiroaLogo } from "@/components/brand/giroa-logo";
import { GiroaTheme } from "@/components/brand/giroa-theme";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <GiroaTheme>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Giroa">
          <GiroaLogo />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#planes" className="hidden text-muted hover:text-foreground sm:inline">
            Planes
          </a>
          <a href="#preguntas" className="hidden text-muted hover:text-foreground sm:inline">
            Preguntas
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
        <div className="mb-3">
          <GiroaLogo className="text-[22px]" />
        </div>
        Hecho en Buenos Aires para estudios de danza y movimiento.
      </footer>
    </GiroaTheme>
  );
}
