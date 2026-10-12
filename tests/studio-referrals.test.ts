import { describe, expect, it } from "vitest";
import { parseReferrerSlug, studioReferralLink, studioReferralMessage } from "@/lib/studio-referrals";

describe("Recomendá Giroa", () => {
  it("el link lleva a la landing con el estudio que recomienda", () => {
    expect(studioReferralLink("tango-sur")).toBe("https://giroa.com.ar/?desde=tango-sur");
    expect(studioReferralMessage("https://giroa.com.ar/?desde=x")).toContain("https://giroa.com.ar/?desde=x");
  });

  it("acepta solo slugs con el formato de studios.slug", () => {
    expect(parseReferrerSlug(" Tango-Sur ")).toBe("tango-sur");
    expect(parseReferrerSlug("ab")).toBeNull();
    expect(parseReferrerSlug("tango sur")).toBeNull();
    expect(parseReferrerSlug("<script>")).toBeNull();
    expect(parseReferrerSlug(null)).toBeNull();
  });
});
