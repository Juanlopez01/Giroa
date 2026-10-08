import { describe, expect, it } from "vitest";
import { bookingIcs } from "@/lib/ics";

describe("bookingIcs", () => {
  const ics = bookingIcs({
    uid: "abc",
    title: "Tango, inicial",
    studioName: "Juan y Juli",
    startsAt: "2026-10-09T22:00:00.000Z",
    endsAt: "2026-10-09T23:30:00.000Z",
    url: "https://juanyjuli.giroa.com.ar/app/reservas",
    now: new Date("2026-10-08T12:00:00Z"),
  });

  it("arma el evento en UTC con aviso una hora antes", () => {
    expect(ics).toContain("DTSTART:20261009T220000Z");
    expect(ics).toContain("DTEND:20261009T233000Z");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics).toContain("UID:abc@giroa.com.ar");
  });

  it("escapa comas y usa CRLF", () => {
    expect(ics).toContain("SUMMARY:Tango\\, inicial · Juan y Juli");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
