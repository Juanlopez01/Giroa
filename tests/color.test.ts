import { describe, expect, it } from "vitest";
import { brandVars, isTooLight, legibleVariant, readableOn } from "@/lib/color";

describe("color de marca", () => {
  it("elige texto blanco sobre colores oscuros y oscuro sobre claros", () => {
    expect(readableOn("#6b1f2e")).toBe("#ffffff");
    expect(readableOn("#1f4e79")).toBe("#ffffff");
    expect(readableOn("#e8c547")).toBe("#1c1917"); // mostaza
    expect(readableOn("#f2d7d0")).toBe("#1c1917"); // nude
  });

  it("detecta colores demasiado claros y propone una versión que se lee", () => {
    expect(isTooLight("#f8f1e5")).toBe(true);
    expect(isTooLight("#6b1f2e")).toBe(false);
    const fixed = legibleVariant("#f2d7d0");
    expect(isTooLight(fixed)).toBe(false);
    expect(legibleVariant("#6b1f2e")).toBe("#6b1f2e");
  });

  it("arma las variables CSS con el texto correcto", () => {
    expect(brandVars("#2f5d50")).toEqual({ "--brand": "#2f5d50", "--brand-foreground": "#ffffff" });
  });
});
