import { describe, expect, it } from "vitest";
import { safeNext, studioUrl, platformUrl } from "@/lib/urls";
import { slugify } from "@/lib/slug";

describe("safeNext (después del login)", () => {
  const fallback = "/estudios";

  it("acepta rutas relativas", () => {
    expect(safeNext("/onboarding", fallback)).toBe("/onboarding");
    expect(safeNext("/onboarding/marca?estudio=1", fallback)).toBe("/onboarding/marca?estudio=1");
  });

  it("acepta URLs de Giroa (app. y estudios)", () => {
    expect(safeNext("https://tango-sur.giroa.com.ar/panel", fallback)).toBe("https://tango-sur.giroa.com.ar/panel");
    expect(safeNext("https://app.giroa.com.ar/estudios", fallback)).toBe("https://app.giroa.com.ar/estudios");
  });

  it("rechaza redirecciones a otros sitios", () => {
    expect(safeNext("https://evil.com/panel", fallback)).toBe(fallback);
    expect(safeNext("//evil.com", fallback)).toBe(fallback);
    expect(safeNext(String.raw`/\evil.com`, fallback)).toBe(fallback);
    expect(safeNext("javascript:alert(1)", fallback)).toBe(fallback);
    expect(safeNext("https://giroa.com.ar.evil.com/", fallback)).toBe(fallback);
    expect(safeNext("http://tango-sur.giroa.com.ar/panel", fallback)).toBe(fallback);
  });

  it("vacío vuelve al default", () => {
    expect(safeNext(null, fallback)).toBe(fallback);
    expect(safeNext("", fallback)).toBe(fallback);
  });

  it("arma las URLs de plataforma y estudio", () => {
    expect(platformUrl("/login")).toBe("https://app.giroa.com.ar/login");
    expect(studioUrl("tango-sur", "/panel")).toBe("https://tango-sur.giroa.com.ar/panel");
  });
});

describe("slugify", () => {
  it("sugiere una dirección limpia desde el nombre", () => {
    expect(slugify("Estudio Tango Sur")).toBe("estudio-tango-sur");
    expect(slugify("  Peña Folklórica  ")).toBe("pena-folklorica");
    expect(slugify("Salsa & Bachata!!")).toBe("salsa-bachata");
    expect(slugify("---")).toBe("");
  });

  it("corta en 40 caracteres sin dejar guion al final", () => {
    const s = slugify("Un nombre larguísimo de estudio de danza contemporánea");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("URLs en desarrollo", () => {
  it("lvh.me y localhost usan http", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "lvh.me:3000");
    const urls = await import("@/lib/urls");
    expect(urls.studioUrl("tango-sur", "/panel")).toBe("http://tango-sur.lvh.me:3000/panel");
    expect(urls.safeNext("http://tango-sur.lvh.me:3000/panel", "/x")).toBe("http://tango-sur.lvh.me:3000/panel");
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
