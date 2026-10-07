import Link from "next/link";
import type { PublicStudio } from "@/lib/studio.server";
import { logoUrl } from "@/lib/studio";

/**
 * Encabezado con la marca del estudio (página pública y app del alumno).
 * Con foto de portada: la foto con un degradé (el texto siempre se lee); en la
 * página pública ("hero") es más alta. Sin portada: el color del estudio.
 */
export function StudioHeader({
  studio,
  action,
  variant = "compact",
}: {
  studio: PublicStudio;
  action?: React.ReactNode;
  variant?: "hero" | "compact";
}) {
  const logo = logoUrl(studio.logo_path);
  const cover = logoUrl(studio.cover_path);
  const tall = variant === "hero" && cover;

  return (
    <header className={`relative ${cover ? "text-white" : "bg-brand text-brand-foreground"}`}>
      {cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className={`absolute inset-0 ${tall ? "bg-gradient-to-t from-black/75 via-black/30 to-black/10" : "bg-black/50"}`}
          />
        </>
      ) : null}
      <div className={`relative mx-auto flex max-w-3xl gap-3 px-5 ${tall ? "min-h-56 items-end pt-16 pb-6 sm:min-h-72" : "items-center py-4"}`}>
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className={`${tall ? "h-14 w-14" : "h-10 w-10"} rounded-xl bg-white object-contain p-1 shadow-sm`}
            />
          ) : (
            <div
              className={`flex ${tall ? "h-14 w-14 text-2xl" : "h-10 w-10 text-lg"} shrink-0 items-center justify-center rounded-xl bg-white/20 font-semibold`}
            >
              {studio.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className={`truncate font-semibold ${tall ? "font-serif text-2xl sm:text-3xl" : "text-lg"}`}>{studio.name}</span>
        </Link>
        {action ? <div className={`ml-auto shrink-0 ${tall ? "absolute top-4 right-5" : ""}`}>{action}</div> : null}
      </div>
    </header>
  );
}
