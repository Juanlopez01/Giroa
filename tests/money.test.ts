import { describe, expect, it } from "vitest";
import { centsToInput, formatArs, parseArsToCents } from "@/lib/money";

describe("plata en pesos", () => {
  it("lee montos escritos como en Argentina", () => {
    expect(parseArsToCents("29900")).toBe(2_990_000);
    expect(parseArsToCents("29.900")).toBe(2_990_000);
    expect(parseArsToCents("$ 29.900")).toBe(2_990_000);
    expect(parseArsToCents("1.250,50")).toBe(125_050);
    expect(parseArsToCents("1250,5")).toBe(125_050);
    expect(parseArsToCents("1250.5")).toBe(125_050);
    expect(parseArsToCents("0")).toBe(0);
  });

  it("rechaza lo que no es un monto", () => {
    expect(parseArsToCents("")).toBeNull();
    expect(parseArsToCents("abc")).toBeNull();
    expect(parseArsToCents("-100")).toBeNull();
    expect(parseArsToCents("1,2,3")).toBeNull();
    expect(parseArsToCents("12.34.5")).toBeNull();
  });

  it("muestra pesos con separador de miles", () => {
    expect(formatArs(2_990_000).replace(/\s/g, " ")).toBe("$ 29.900");
    expect(formatArs(125_050).replace(/\s/g, " ")).toBe("$ 1.250,50");
  });

  it("vuelve al input sin perder centavos", () => {
    expect(centsToInput(2_990_000)).toBe("29.900");
    expect(centsToInput(125_050)).toBe("1.250,50");
    expect(parseArsToCents(centsToInput(125_050))).toBe(125_050);
  });
});
