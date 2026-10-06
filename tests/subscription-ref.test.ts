import { describe, expect, it } from "vitest";
import { decodeRef, encodeRef } from "@/lib/mp/subscriptions";

describe("external_reference de la suscripción", () => {
  const ref = { studioId: "11111111-1111-4111-8111-111111111111", plan: "estudio", cycle: "annual", coupon: "FUNDADOR" } as const;

  it("ida y vuelta", () => {
    expect(decodeRef(encodeRef(ref))).toEqual(ref);
    expect(decodeRef(encodeRef({ ...ref, coupon: null }))).toEqual({ ...ref, coupon: null });
  });

  it("rechaza referencias que no son de Giroa o están mal armadas", () => {
    expect(decodeRef("pack-123")).toBeNull();
    expect(decodeRef("giroa|no-es-uuid|estudio|monthly|")).toBeNull();
    expect(decodeRef("giroa|11111111-1111-4111-8111-111111111111|gratis|monthly|")).toBeNull();
    expect(decodeRef(null)).toBeNull();
  });
});
