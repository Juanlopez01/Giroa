import "server-only";

/** Envía un mail con Resend. Tira error si Resend no lo acepta. */
export async function sendWithResend(
  apiKey: string,
  mail: { from: string; to: string; subject: string; html: string; text: string; reply_to?: string },
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(mail),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
