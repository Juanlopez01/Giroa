import Link from "next/link";
import type { PublicStudio } from "@/lib/studio.server";
import { logoUrl } from "@/lib/studio";

/** Encabezado con la marca del estudio (página pública y app del alumno). */
export function StudioHeader({ studio, action }: { studio: PublicStudio; action?: React.ReactNode }) {
  const logo = logoUrl(studio.logo_path);
  return (
    <header className="bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg font-semibold">
              {studio.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="truncate text-lg font-semibold">{studio.name}</span>
        </Link>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
