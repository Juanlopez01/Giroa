// Archivo .ics de una clase ("Agregar a mi calendario"): lo abren Google
// Calendar, el calendario del iPhone y Outlook.

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

export function bookingIcs(input: {
  uid: string;
  title: string;
  studioName: string;
  startsAt: string;
  endsAt: string;
  url: string;
  now?: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Giroa//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@giroa.com.ar`,
    `DTSTAMP:${icsDate((input.now ?? new Date()).toISOString())}`,
    `DTSTART:${icsDate(input.startsAt)}`,
    `DTEND:${icsDate(input.endsAt)}`,
    `SUMMARY:${escape(`${input.title} · ${input.studioName}`)}`,
    `DESCRIPTION:${escape(`Tu reserva en ${input.studioName}. Si no podés ir, cancelala desde la app: ${input.url}`)}`,
    `URL:${input.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tenés clase en 1 hora",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
