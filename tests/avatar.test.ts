import { describe, expect, it } from "vitest";
import { initials } from "@/components/ui/avatar";

describe("initials", () => {
  it("toma las dos primeras palabras", () => {
    expect(initials("Martina Sosa")).toBe("MS");
    expect(initials("ana maría  de la torre")).toBe("AM");
  });
  it("una sola palabra o vacío", () => {
    expect(initials("nadia")).toBe("N");
    expect(initials("  ")).toBe("?");
  });
});
