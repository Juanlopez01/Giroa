import { describe, expect, it } from "vitest";
import { classReminderEmail, eventTicketsEmail, packExpiringEmail, packGrantedEmail } from "@/lib/email/templates";

const studio = { name: "Tango del Sur", timezone: "America/Argentina/Buenos_Aires", url: (p: string) => `https://demo.giroa.com.ar${p}` };

describe("mails de avisos", () => {
  it("entradas: link privado, fecha local y plural", () => {
    const m = eventTicketsEmail(studio, "Lucía Gómez", {
      eventTitle: "Milonga de primavera",
      startsAt: "2026-10-18T00:30:00.000Z",
      venue: "Salón Canning",
      quantity: 2,
      accessToken: "abc123",
    });
    expect(m.subject).toBe("Tus 2 entradas para Milonga de primavera");
    expect(m.html).toContain("https://demo.giroa.com.ar/entradas/abc123");
    expect(m.text).toContain("Hola, Lucía.");
    expect(m.text).toContain("sábado 17/10 a las 21:30 en Salón Canning");
  });

  it("escapa el HTML de los datos", () => {
    const m = classReminderEmail(studio, "<b>Ana</b>", { title: "Tango <script>", startsAt: "2026-10-10T22:00:00.000Z" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("pack acreditado: último día válido en hora local", () => {
    // expires_at = primer instante en que ya no vale (00:00 del 6/11 en BA).
    const m = packGrantedEmail(studio, "Ana", { name: "8 clases", credits: 8, expiresAt: "2026-11-06T03:00:00.000Z" });
    expect(m.text).toContain("Te acreditamos 8 clases. Valen hasta el jueves 5/11.");
  });

  it("pack por vencer con clases restantes", () => {
    const m = packExpiringEmail(studio, null, { name: "4 clases", creditsRemaining: 1, expiresOn: "2026-10-10" });
    expect(m.text).toContain("Hola.");
    expect(m.text).toContain("Vence el sábado 10/10. Te queda 1 clase.");
  });
});

describe("lista de espera", () => {
  it("avisa que se liberó un lugar con link para reservar", async () => {
    const { waitlistSpotEmail } = await import("@/lib/email/templates");
    const m = waitlistSpotEmail(studio, "Beto", { title: "Yoga", startsAt: "2026-10-08T22:00:00.000Z" });
    expect(m.subject).toBe("¡Se liberó un lugar! Yoga, 19:00");
    expect(m.html).toContain("https://demo.giroa.com.ar/app/clases");
  });
});

describe("invitación al equipo", () => {
  it("dice el rol y lleva al link de aceptar", async () => {
    const { staffInviteEmail } = await import("@/lib/email/templates");
    const m = staffInviteEmail(studio, { name: "Lucía", role: "teacher", acceptUrl: "https://app.giroa.com.ar/invitacion/abc" });
    expect(m.subject).toBe("Te sumaron al equipo de Tango del Sur");
    expect(m.text).toContain("como profe");
    expect(m.html).toContain("https://app.giroa.com.ar/invitacion/abc");
  });
});

describe("gift card", () => {
  it("le manda a quien la compró el código y el link de la tarjeta", async () => {
    const { giftCardEmail } = await import("@/lib/email/templates");
    const m = giftCardEmail(studio, { buyerName: "Juan Pérez", recipientName: "Lía", packName: "8 clases", code: "REGALO-7K2M-Q9XA", cardUrl: "https://demo.giroa.com.ar/regalo/abc" });
    expect(m.subject).toBe("Tu regalo para Lía está listo");
    expect(m.text).toContain("REGALO-7K2M-Q9XA");
    expect(m.html).toContain("https://demo.giroa.com.ar/regalo/abc");
  });
});
