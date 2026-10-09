import { describe, expect, it } from "vitest";
import { REF_CODE, referralMessage } from "@/lib/referrals";

describe("referidos", () => {
  it("valida el código de invitación", () => {
    expect(REF_CODE.test("NS3TB8")).toBe(true);
    expect(REF_CODE.test("NS3TB")).toBe(false);
    expect(REF_CODE.test("NS3TB8?x=1")).toBe(false);
  });
  it("arma el mensaje para WhatsApp", () => {
    expect(referralMessage("Tango del Sur", "https://x/sumate?ref=AAAAAA", 1)).toBe(
      "¡Vení a Tango del Sur conmigo! Sumate con este link y con tu primer pack te dan 1 clase de regalo: https://x/sumate?ref=AAAAAA",
    );
    expect(referralMessage("Yoga", "l", 2)).toContain("2 clases de regalo");
  });
});
