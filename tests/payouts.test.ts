import { describe, expect, it } from "vitest";
import { formatArs } from "@/lib/money";
import { computePayouts, describeRule, monthLabel, monthRange, parseMonth, payeeKey, shiftMonth, type PayoutRule, type PayoutSession } from "@/lib/payouts";

const tango = "o-tango";
const yoga = "o-yoga";
const session = (id: string, offeringId: string, startsAt: string, present: number, revenueCents: number): PayoutSession => ({
  sessionId: id,
  offeringId,
  title: offeringId === tango ? "Tango inicial" : "Yoga",
  startsAt,
  present,
  used: present,
  revenueCents,
});

describe("computePayouts", () => {
  const rules: PayoutRule[] = [
    { offeringId: tango, payeeName: "Lucía Ferrari", memberId: null, kind: "percent", percent: 30, amountCents: null },
    { offeringId: tango, payeeName: "Martín", memberId: "m-1", kind: "per_student", amountCents: 50000, percent: null },
    { offeringId: yoga, payeeName: "lucía  ferrari ", memberId: null, kind: "per_class", amountCents: 1500000, percent: null },
  ];
  const sessions = [
    session("s2", tango, "2026-10-08T22:00:00Z", 10, 4750000),
    session("s1", tango, "2026-10-01T22:00:00Z", 8, 3800000),
    session("s3", yoga, "2026-10-04T13:00:00Z", 5, 2000000),
    session("s4", "o-sin-reglas", "2026-10-05T13:00:00Z", 9, 9000000),
  ];
  const payees = computePayouts(sessions, rules);

  it("suma por profe en todas sus clases (aunque escriban distinto el nombre)", () => {
    expect(payees.map((p) => [p.name, p.totalCents, p.classes, p.students])).toEqual([
      // 30% de 38.000 y de 47.500 (11.400 + 14.250) + 15.000 fijos del yoga.
      ["Lucía Ferrari", 1140000 + 1425000 + 1500000, 3, 23],
      // $500 por cada uno de los 18 presentes.
      ["Martín", 900000, 2, 18],
    ]);
  });

  it("el detalle va por fecha y explica la regla", () => {
    const lucia = payees[0]!;
    expect(lucia.lines.map((l) => l.sessionId)).toEqual(["s1", "s3", "s2"]);
    expect(lucia.lines[1]).toMatchObject({ rule: `${formatArs(1500000)} por clase`, earnedCents: 1500000 });
  });

  it("sin reglas no hay nada que liquidar", () => {
    expect(computePayouts(sessions, [])).toEqual([]);
  });
});

describe("helpers", () => {
  it("payeeKey igual que en la base", () => {
    expect(payeeKey(null, "  Lucía   Ferrari ")).toBe("n:lucía ferrari");
    expect(payeeKey("m-1", "Martín")).toBe("m-1");
  });
  it("describeRule", () => {
    expect(describeRule({ kind: "per_student", amountCents: 50000, percent: null })).toBe(`${formatArs(50000)} por alumno presente`);
    expect(describeRule({ kind: "percent", amountCents: null, percent: 12.5 })).toBe("12,5% de lo que generó la clase");
  });
  it("meses", () => {
    expect(parseMonth("2026-10")).toBe("2026-10");
    expect(parseMonth("2026-13")).toBeNull();
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-03")).toBe("marzo 2026");
    const r = monthRange("2026-10", "America/Argentina/Buenos_Aires");
    expect(r.from.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});
