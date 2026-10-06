import { describe, expect, it } from "vitest";
import { addDaysYmd, formatDayLabel, formatTime, startOfDay, todayYmd, toHhmm, toYmd, weekdayOf, zonedDateTime } from "@/lib/datetime";

const BA = "America/Argentina/Buenos_Aires";

describe("fechas en la zona del estudio", () => {
  it("el día empieza a las 00:00 de Buenos Aires (03:00 UTC)", () => {
    expect(startOfDay("2026-10-06", BA).toISOString()).toBe("2026-10-06T03:00:00.000Z");
  });

  it("de noche en Argentina ya es mañana en UTC, pero el día local es hoy", () => {
    const lateNight = new Date("2026-10-07T01:30:00Z"); // 22:30 del 6/10 en BA
    expect(toYmd(lateNight, BA)).toBe("2026-10-06");
    expect(todayYmd(BA, lateNight)).toBe("2026-10-06");
    expect(formatTime(lateNight, BA)).toBe("22:30");
  });

  it("suma días cruzando meses", () => {
    expect(addDaysYmd("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDaysYmd("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("día de la semana y etiqueta", () => {
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(formatDayLabel("2026-10-05")).toBe("Lunes 5/10");
  });

  it("respeta zonas con horario de verano", () => {
    // Madrid: 26/10/2026 ya en horario de invierno (UTC+1).
    expect(startOfDay("2026-10-26", "Europe/Madrid").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("fecha y hora locales", () => {
  it("21:30 del sábado en Buenos Aires es 00:30 UTC del domingo", () => {
    const d = zonedDateTime("2026-10-10", "21:30", BA);
    expect(d.toISOString()).toBe("2026-10-11T00:30:00.000Z");
    expect(toYmd(d, BA)).toBe("2026-10-10");
    expect(toHhmm(d, BA)).toBe("21:30");
  });
});

describe("horario de un evento", () => {
  it("si termina antes de la hora de inicio, termina al día siguiente", async () => {
    const { eventInstants, formatEventWhen } = await import("@/lib/events");
    const { startsAt, endsAt } = eventInstants("2026-10-10", "21:30", "03:00", BA);
    expect(endsAt?.toISOString()).toBe("2026-10-11T06:00:00.000Z");
    expect(formatEventWhen(startsAt, endsAt, BA)).toBe("Sábado 10/10 · 21:30 a 03:00");
    expect(eventInstants("2026-10-10", "18:00", null, BA).endsAt).toBeNull();
  });
});
