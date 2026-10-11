import { describe, expect, it } from "vitest";
import { detectChurn, usedToComeLabel } from "@/lib/churn";

const now = new Date("2026-10-11T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("detectChurn", () => {
  const visits = [
    // Ana: venía seguido y no viene hace 20 días → abandono.
    ...[20, 25, 30, 35, 40].map((d) => ({ studentId: "ana", at: daysAgo(d) })),
    // Beto: venía seguido y vino hace 3 días → no.
    ...[3, 20, 30, 40].map((d) => ({ studentId: "beto", at: daysAgo(d) })),
    // Carla: vino 2 veces nomás → no cuenta.
    ...[20, 30].map((d) => ({ studentId: "carla", at: daysAgo(d) })),
    // Dani: como Ana pero tiene una clase reservada → no.
    ...[20, 25, 30].map((d) => ({ studentId: "dani", at: daysAgo(d) })),
  ];

  it("marca solo a quien venía seguido, no viene hace días y no reservó", () => {
    const out = detectChurn(visits, new Set(["dani"]), now, 14);
    expect(out.map((c) => c.studentId)).toEqual(["ana"]);
    expect(out[0]).toMatchObject({ visits: 5, daysAway: 20 });
  });

  it("respeta los días configurados", () => {
    expect(detectChurn(visits, new Set(["dani"]), now, 21)).toEqual([]);
  });
});

describe("usedToComeLabel", () => {
  it("habla por semana o por mes", () => {
    expect(usedToComeLabel(17)).toBe("Venía 2 veces por semana");
    expect(usedToComeLabel(9)).toBe("Venía 1 vez por semana");
    expect(usedToComeLabel(4)).toBe("Venía 2 veces por mes");
    expect(usedToComeLabel(3)).toBe("Venía 2 veces por mes");
  });
});
