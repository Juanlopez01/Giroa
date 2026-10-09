import { describe, expect, it } from "vitest";
import { describePackRules, hasRules, parsePackRules } from "@/lib/pack-rules";

describe("parsePackRules", () => {
  it("descarta lo inválido y los 7 días (es lo mismo que ninguno)", () => {
    expect(parsePackRules({ disciplines: ["yoga", "", 3], weekdays: [1, 1, 9, "2"], from: "25:00", until: "17:00" })).toEqual({
      disciplines: ["yoga"],
      weekdays: [1, 2],
      until: "17:00",
    });
    expect(parsePackRules({ weekdays: [0, 1, 2, 3, 4, 5, 6] })).toEqual({});
    expect(hasRules(parsePackRules(null))).toBe(false);
  });
});

describe("describePackRules", () => {
  const names = { disciplines: { yoga: "Yoga", pilates: "Pilates" } };
  it("arma el texto corto", () => {
    expect(describePackRules({ disciplines: ["yoga"], weekdays: [1, 2, 3, 4, 5], until: "17:00" }, names)).toBe(
      "Solo Yoga · Lun a Vie · Antes de las 17:00",
    );
    expect(describePackRules({ disciplines: ["yoga", "pilates"], weekdays: [6, 0] }, names)).toBe("Solo Yoga y Pilates · Sáb y Dom");
    expect(describePackRules({ weekdays: [1, 3, 5], from: "08:00", until: "12:00" })).toBe("Lun, Mié y Vie · De 08:00 a 12:00");
    expect(describePackRules({})).toBeNull();
  });
});
