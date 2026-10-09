import { describe, expect, it } from "vitest";
import { membershipChargeError, nextChargeLabel } from "@/lib/memberships";

describe("membershipChargeError", () => {
  it("traduce el motivo de MP o usa uno genérico", () => {
    expect(membershipChargeError("cc_rejected_insufficient_amount")).toBe("Fondos insuficientes");
    expect(membershipChargeError("algo_nuevo")).toBe("Cobro rechazado");
    expect(membershipChargeError(null)).toBe("Cobro rechazado");
  });
});

describe("nextChargeLabel", () => {
  const tz = "America/Argentina/Buenos_Aires";
  it("dice cuándo se cobra", () => {
    const now = new Date("2026-10-09T15:00:00Z");
    expect(nextChargeLabel("2026-11-12T15:00:00Z", tz, now)).toBe("Se cobra el 12/11");
    expect(nextChargeLabel("2026-10-09T20:00:00Z", tz, now)).toBe("Se cobra hoy");
    expect(nextChargeLabel(null, tz, now)).toBeNull();
  });
});
