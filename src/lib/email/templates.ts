// Plantillas de los mails de avisos. Funciones puras (testeables): reciben los
// datos ya resueltos y devuelven asunto, HTML y texto.

import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";

export type EmailContent = { subject: string; html: string; text: string };

export type StudioInfo = { name: string; timezone: string; url: (path: string) => string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(studio: StudioInfo, title: string, paragraphs: string[], cta?: { label: string; href: string }): string {
  const body = paragraphs.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 16px;">${p}</p>`).join("");
  const button = cta
    ? `<a href="${esc(cta.href)}" style="display:inline-block;background:#6b1f2e;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;margin:8px 0 24px;">${esc(cta.label)}</a>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f1a17;">
<p style="font-size:13px;color:#6f6259;margin:0 0 8px;">${esc(studio.name)}</p>
<h1 style="font-size:22px;margin:0 0 16px;">${esc(title)}</h1>
${body}${button}
<p style="font-size:12px;color:#6f6259;margin:24px 0 0;">Te escribimos por tu actividad en ${esc(studio.name)}. Enviado con Giroa.</p>
</div>`;
}

function textOf(title: string, paragraphs: string[], cta?: { label: string; href: string }) {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return [title, "", ...paragraphs.map(strip), ...(cta ? ["", `${cta.label}: ${cta.href}`] : [])].join("\n");
}

function build(studio: StudioInfo, title: string, paragraphs: string[], cta?: { label: string; href: string }, subject = title) {
  return { subject, html: layout(studio, title, paragraphs, cta), text: textOf(title, paragraphs, cta) };
}

const when = (iso: string, tz: string) => `${formatDayLabel(toYmd(new Date(iso), tz)).toLowerCase()} a las ${formatTime(iso, tz)}`;
const firstName = (name: string | null) => (name ? name.split(" ")[0] : null);
const hola = (name: string | null) => (firstName(name) ? `Hola, ${esc(firstName(name)!)}.` : "Hola.");

export type EventTicketsData = { eventTitle: string; startsAt: string; venue: string | null; quantity: number; accessToken: string };

export function eventTicketsEmail(studio: StudioInfo, buyerName: string, d: EventTicketsData): EmailContent {
  const title = d.quantity === 1 ? `Tu entrada para ${d.eventTitle}` : `Tus ${d.quantity} entradas para ${d.eventTitle}`;
  return build(
    studio,
    title,
    [
      hola(buyerName),
      `Te esperamos el ${esc(when(d.startsAt, studio.timezone))}${d.venue ? ` en ${esc(d.venue)}` : ""}.`,
      d.quantity === 1
        ? "Mostrá el QR en la entrada. Lo tenés en este link:"
        : "Cada persona entra con su QR. Los tenés todos en este link:",
    ],
    { label: d.quantity === 1 ? "Ver mi entrada" : "Ver mis entradas", href: studio.url(`/entradas/${d.accessToken}`) },
  );
}

export function packGrantedEmail(
  studio: StudioInfo,
  studentName: string | null,
  d: { name: string; credits: number | null; expiresAt: string },
): EmailContent {
  const credits = d.credits === null ? "clases libres" : d.credits === 1 ? "1 clase" : `${d.credits} clases`;
  return build(
    studio,
    `Ya tenés tu pack ${d.name}`,
    [hola(studentName), `Te acreditamos ${credits}. Valen hasta el ${esc(formatDayLabel(toYmd(new Date(new Date(d.expiresAt).getTime() - 1), studio.timezone)).toLowerCase())}.`, "Ya podés reservar tu lugar."],
    { label: "Reservar una clase", href: studio.url("/app/clases") },
  );
}

export function packExpiringEmail(
  studio: StudioInfo,
  studentName: string | null,
  d: { name: string; creditsRemaining: number | null; expiresOn: string },
): EmailContent {
  const left =
    d.creditsRemaining === null ? "" : d.creditsRemaining === 1 ? " Te queda 1 clase." : ` Te quedan ${d.creditsRemaining} clases.`;
  return build(
    studio,
    `Tu pack ${d.name} está por vencer`,
    [hola(studentName), `Vence el ${esc(formatDayLabel(d.expiresOn).toLowerCase())}.${left}`, "Aprovechalas o renová tu pack para seguir viniendo."],
    { label: "Ver packs", href: studio.url("/app/packs") },
  );
}

export function classReminderEmail(studio: StudioInfo, studentName: string | null, d: { title: string; startsAt: string }): EmailContent {
  return build(
    studio,
    `Te esperamos en ${d.title}`,
    [hola(studentName), `Tenés reservada <strong>${esc(d.title)}</strong> el ${esc(when(d.startsAt, studio.timezone))}.`, "Si no podés venir, cancelá desde la app así le dejás el lugar a otra persona."],
    { label: "Ver mis clases", href: studio.url("/app") },
    `Recordatorio: ${d.title}, ${formatTime(d.startsAt, studio.timezone)}`,
  );
}

export function sessionCancelledEmail(
  studio: StudioInfo,
  studentName: string | null,
  d: { title: string; startsAt: string; reason: string | null },
): EmailContent {
  return build(
    studio,
    `Se canceló ${d.title}`,
    [
      hola(studentName),
      `El estudio canceló la clase de <strong>${esc(d.title)}</strong> del ${esc(when(d.startsAt, studio.timezone))}.`,
      ...(d.reason ? [`Motivo: ${esc(d.reason)}`] : []),
      "Te devolvimos la clase a tu saldo.",
    ],
    { label: "Reservar otra clase", href: studio.url("/app/clases") },
  );
}

export function waitlistSpotEmail(studio: StudioInfo, studentName: string | null, d: { title: string; startsAt: string }): EmailContent {
  return build(
    studio,
    `Se liberó un lugar en ${d.title}`,
    [
      hola(studentName),
      `Estabas en la lista de espera de <strong>${esc(d.title)}</strong> del ${esc(when(d.startsAt, studio.timezone))} y se liberó un lugar.`,
      "El primero que reserva se lo queda: si querés ir, reservá ya.",
    ],
    { label: "Reservar mi lugar", href: studio.url("/app/clases") },
    `¡Se liberó un lugar! ${d.title}, ${formatTime(d.startsAt, studio.timezone)}`,
  );
}

export function staffInviteEmail(
  studio: StudioInfo,
  d: { name: string | null; role: string; acceptUrl: string },
): EmailContent {
  const role = d.role === "admin" ? "encargado/a" : "profe";
  return build(
    studio,
    `Te sumaron al equipo de ${studio.name}`,
    [
      hola(d.name),
      `${esc(studio.name)} te invitó a su panel en Giroa como <strong>${role}</strong>.`,
      "Aceptá la invitación entrando con este mismo email. El link vence en 7 días.",
    ],
    { label: "Aceptar invitación", href: d.acceptUrl },
  );
}

export function giftCardEmail(
  studio: StudioInfo,
  d: { buyerName: string; recipientName: string | null; packName: string; code: string; cardUrl: string },
): EmailContent {
  return build(
    studio,
    d.recipientName ? `Tu regalo para ${d.recipientName} está listo` : "Tu gift card está lista",
    [
      hola(d.buyerName),
      `Ya está la gift card de <strong>${esc(d.packName)}</strong> en ${esc(studio.name)}. El código es <strong>${esc(d.code)}</strong>.`,
      "En este link tenés la tarjeta para mandarla por WhatsApp o imprimirla. Vale 12 meses y las clases corren desde que se canjea.",
    ],
    { label: "Ver la tarjeta", href: d.cardUrl },
  );
}

export type FormationMail =
  | { kind: "approved"; title: string; feeCents: number | null; url: string }
  | { kind: "rejected"; title: string; url: string }
  | { kind: "enrolled"; title: string; url: string }
  | { kind: "due"; title: string; number: number; amountCents: number; dueOn: string; url: string }
  | { kind: "overdue"; title: string; number: number; amountCents: number; dueOn: string; url: string };

const ars = (cents: number) => `$ ${Math.round(cents / 100).toLocaleString("es-AR")}`;
const ymdLabel = (ymd: string) => ymd.split("-").reverse().map(Number).join("/");

export function formationEmail(studio: StudioInfo, studentName: string | null, d: FormationMail): EmailContent {
  switch (d.kind) {
    case "approved":
      return build(
        studio,
        `¡Quedaste en ${d.title}!`,
        [
          hola(studentName),
          `${esc(studio.name)} aceptó tu postulación a <strong>${esc(d.title)}</strong>.`,
          d.feeCents ? `Para asegurar tu lugar, pagá la matrícula de ${ars(d.feeCents)} en los próximos 7 días.` : "Ya podés ver el cronograma.",
        ],
        { label: d.feeCents ? "Pagar la matrícula" : "Ver mi formación", href: d.url },
      );
    case "rejected":
      return build(
        studio,
        `Sobre tu postulación a ${d.title}`,
        [hola(studentName), `Gracias por postularte a <strong>${esc(d.title)}</strong>. Esta vez no quedaste.`, "Podés consultar con el estudio por próximas convocatorias."],
        { label: "Ver detalle", href: d.url },
      );
    case "enrolled":
      return build(
        studio,
        `Ya estás inscripto/a en ${d.title}`,
        [hola(studentName), `¡Bienvenido/a a <strong>${esc(d.title)}</strong>! En tu app tenés el cronograma, tus cuotas y tu asistencia.`],
        { label: "Ver mi formación", href: d.url },
      );
    case "due":
      return build(
        studio,
        `Tu cuota ${d.number} de ${d.title} vence el ${ymdLabel(d.dueOn)}`,
        [hola(studentName), `Te recordamos que la cuota ${d.number} (${ars(d.amountCents)}) vence el ${ymdLabel(d.dueOn)}.`, "La podés pagar desde la app con Mercado Pago."],
        { label: "Pagar la cuota", href: d.url },
      );
    case "overdue":
      return build(
        studio,
        `Tenés la cuota ${d.number} de ${d.title} vencida`,
        [
          hola(studentName),
          `La cuota ${d.number} (${ars(d.amountCents)}) venció el ${ymdLabel(d.dueOn)}.`,
          "Hasta que la pagues, el acceso a la formación queda en pausa. Tus clases regulares las seguís reservando.",
        ],
        { label: "Pagar ahora", href: d.url },
      );
  }
}

export function auditionEmail(
  studio: StudioInfo,
  studentName: string | null,
  d: { kind: "submitted" | "reminder" | "waitlisted" | "rejected"; title: string; slotAt: string | null; url: string },
): EmailContent {
  const turno = d.slotAt ? `Tu turno es el ${esc(when(d.slotAt, studio.timezone))}.` : "";
  switch (d.kind) {
    case "submitted":
      return build(
        studio,
        `Estás inscripto/a a ${d.title}`,
        [hola(studentName), `Recibimos tu inscripción a <strong>${esc(d.title)}</strong>.`, ...(turno ? [turno] : []), "Cuando haya resultados, te avisamos por acá."],
        { label: "Ver mi audición", href: d.url },
      );
    case "reminder":
      return build(
        studio,
        `Mañana es tu audición`,
        [hola(studentName), `Te esperamos para <strong>${esc(d.title)}</strong>. ${turno}`, "Llegá unos minutos antes. ¡Éxitos!"],
        { label: "Ver mi audición", href: d.url },
        `Mañana: ${d.title}`,
      );
    case "waitlisted":
      return build(
        studio,
        `Quedaste en lista de espera`,
        [hola(studentName), `Gracias por audicionar para <strong>${esc(d.title)}</strong>. Quedaste en lista de espera: si se libera un lugar, el estudio te avisa.`],
        { label: "Ver mi audición", href: d.url },
      );
    case "rejected":
      return build(
        studio,
        `Sobre tu audición`,
        [hola(studentName), `Gracias por audicionar para <strong>${esc(d.title)}</strong>. Esta vez no quedaste.`, "Consultá con el estudio por próximas convocatorias."],
        { label: "Ver detalle", href: d.url },
      );
  }
}
