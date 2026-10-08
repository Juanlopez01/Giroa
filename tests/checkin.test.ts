import { describe, expect, it } from "vitest";
import { checkinPath, parseCheckinCode } from "@/lib/checkin";

const CODE = "0123456789abcdef0123";

describe("parseCheckinCode", () => {
  it("lee el link del cartel", () => {
    expect(parseCheckinCode(`https://juanyjuli.giroa.com.ar${checkinPath(CODE)}`)).toBe(CODE);
  });
  it("acepta el código solo y en mayúsculas", () => {
    expect(parseCheckinCode(CODE.toUpperCase())).toBe(CODE);
  });
  it("rechaza otros QR", () => {
    expect(parseCheckinCode("giroa:abcdef")).toBeNull();
    expect(parseCheckinCode("https://juanyjuli.giroa.com.ar/app/clases?c=" + CODE)).toBeNull();
    expect(parseCheckinCode("https://juanyjuli.giroa.com.ar/app/presente?c=nope")).toBeNull();
  });
});
