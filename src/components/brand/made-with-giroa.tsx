import { studioReferralLink } from "@/lib/studio-referrals";

/**
 * Pie de las páginas de un estudio: "Reservas con Giroa", con link a la landing.
 * El link lleva ?desde=<slug>: si otro estudio se registra desde ahí, cuenta
 * como recomendación de este estudio. Aparece siempre, en todos los planes.
 */
export function MadeWithGiroa({ slug, label = "Reservas con" }: { slug: string; label?: string }) {
  return (
    <footer className="px-5 py-6 text-center text-xs text-muted">
      <a href={studioReferralLink(slug)} target="_blank" rel="noopener" className="hover:text-foreground">
        {label} <span className="font-semibold">Giroa</span>
      </a>
    </footer>
  );
}
