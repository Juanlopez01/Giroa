import Link from "next/link";
import { platformUrl } from "@/lib/urls";
import { GiroaLogo } from "@/components/brand/giroa-logo";
import { GiroaTheme } from "@/components/brand/giroa-theme";
import { WhatsAppButton, whatsappHref } from "./whatsapp-button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <GiroaTheme>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Giroa">
          <GiroaLogo />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/#planes" className="hidden text-muted hover:text-foreground sm:inline">
            Planes
          </Link>
          <Link href="/#preguntas" className="hidden text-muted hover:text-foreground sm:inline">
            Preguntas
          </Link>
          <Link href="/#fundadores" className="hidden text-muted hover:text-foreground sm:inline">
            Fundadores
          </Link>
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
        <p>Hecho en Argentina para estudios de danza y movimiento.</p>
        <nav className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href="/#preguntas" className="hover:text-foreground">
            Preguntas frecuentes
          </Link>
          <Link href="/terminos" className="hover:text-foreground">
            Términos de uso
          </Link>
          <Link href="/privacidad" className="hover:text-foreground">
            Política de privacidad
          </Link>
          <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            WhatsApp
          </a>
          <a href="mailto:hola@giroa.com.ar" className="hover:text-foreground">
            hola@giroa.com.ar
          </a>
        </nav>
      </footer>
      <WhatsAppButton />
    </GiroaTheme>
  );
}
