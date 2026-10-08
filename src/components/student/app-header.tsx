import Link from "next/link";
import type { PublicStudio } from "@/lib/studio.server";
import { logoUrl } from "@/lib/studio";

/**
 * Encabezado de la app del alumno: chico, pegado arriba y translúcido, para
 * que al bajar no tape el contenido (la portada queda para la página pública).
 */
export function AppHeader({ studio }: { studio: PublicStudio }) {
  const logo = logoUrl(studio.logo_path);
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-5">
        <Link href="/app" className="flex min-w-0 items-center gap-2.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground">
              {studio.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-semibold tracking-wide">{studio.name}</span>
        </Link>
      </div>
    </header>
  );
}
