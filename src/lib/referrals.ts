// Referidos: link de invitación de cada alumno y textos.

/** Código de invitación (students.referral_code): 6 letras y números, sin los que se confunden. */
export const REF_CODE = /^[A-Za-z0-9]{6}$/;

/** Mensaje para compartir por WhatsApp. */
export function referralMessage(studioName: string, link: string, credits: number): string {
  const gift = credits === 1 ? "1 clase de regalo" : `${credits} clases de regalo`;
  return `¡Vení a ${studioName} conmigo! Sumate con este link y con tu primer pack te dan ${gift}: ${link}`;
}
