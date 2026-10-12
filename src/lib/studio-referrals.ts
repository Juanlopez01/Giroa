import { marketingUrl } from "@/lib/urls";

// Recomendaciones entre estudios ("Recomendá Giroa"). El link es la landing
// con ?desde=<slug>; el proxy lo guarda en una cookie y el onboarding lo anota
// (claim_studio_referral). Premio: 10% por estudio que paga, hasta 25%.

export const REFERRAL_PARAM = "desde";
export const REFERRAL_COOKIE = "giroa_desde";
/** 30 días: alcanza para que el estudio mire la landing y vuelva a registrarse. */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Slug de un estudio válido (mismo formato que studios.slug) o null. */
export function parseReferrerSlug(value: string | null | undefined): string | null {
  const slug = (value ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{3,40}$/.test(slug) ? slug : null;
}

/** Link a la landing que anota al estudio como el que recomendó. */
export function studioReferralLink(slug: string): string {
  return marketingUrl(`/?${REFERRAL_PARAM}=${encodeURIComponent(slug)}`);
}

/** Mensaje para compartir con otros profes y estudios. */
export function studioReferralMessage(link: string): string {
  return `¡Hola! Uso Giroa en mi estudio: los alumnos reservan y pagan solos desde el celu. Probalo 14 días gratis: ${link}`;
}
