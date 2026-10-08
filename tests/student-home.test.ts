import { describe, expect, it } from "vitest";
import { greeting, inCheckinWindow, untilLabel, weeklyCounts } from "@/lib/student-home";

const TZ = "America/Argentina/Buenos_Aires";
// Jueves 8/10/2026 10:00 en Buenos Aires (UTC-3).
const NOW = new Date("2026-10-08T13:00:00Z");
const at = (iso: string) => new Date(iso).toISOString();

describe("greeting", () => {
  it("según la hora del estudio", () => {
    expect(greeting(NOW, TZ)).toBe("Buen día");
    expect(greeting(new Date("2026-10-08T19:00:00Z"), TZ)).toBe("Buenas tardes");
    expect(greeting(new Date("2026-10-09T01:00:00Z"), TZ)).toBe("Buenas noches");
  });
});

describe("untilLabel", () => {
  it("falta poco", () => {
    expect(untilLabel(at("2026-10-08T13:25:00Z"), NOW, TZ)).toBe("en 25 min");
    expect(untilLabel(at("2026-10-08T15:15:00Z"), NOW, TZ)).toBe("en 2 h 15 min");
    expect(untilLabel(at("2026-10-08T15:00:00Z"), NOW, TZ)).toBe("en 2 h");
    expect(untilLabel(at("2026-10-08T12:50:00Z"), NOW, TZ)).toBe("En curso");
  });
  it("hoy, mañana u otro día", () => {
    expect(untilLabel(at("2026-10-08T22:00:00Z"), NOW, TZ)).toBe("Hoy 19:00");
    expect(untilLabel(at("2026-10-09T22:00:00Z"), NOW, TZ)).toBe("Mañana 19:00");
    expect(untilLabel(at("2026-10-12T22:00:00Z"), NOW, TZ)).toBe("Lunes 12/10 · 19:00");
  });
});

describe("inCheckinWindow", () => {
  it("desde 30 minutos antes hasta que termina", () => {
    expect(inCheckinWindow(at("2026-10-08T13:20:00Z"), at("2026-10-08T14:20:00Z"), NOW)).toBe(true);
    expect(inCheckinWindow(at("2026-10-08T13:40:00Z"), at("2026-10-08T14:40:00Z"), NOW)).toBe(false);
    expect(inCheckinWindow(at("2026-10-08T11:00:00Z"), at("2026-10-08T12:00:00Z"), NOW)).toBe(false);
  });
});

describe("weeklyCounts", () => {
  it("agrupa por semana del mes", () => {
    expect(weeklyCounts([1, 3, 8, 22, 30, 31])).toEqual([2, 1, 0, 1, 2]);
  });
});
