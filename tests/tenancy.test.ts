import { describe, expect, it } from "vitest";
import { resolveHost } from "@/lib/tenancy/host";
import { decideRoute } from "@/lib/tenancy/route";

describe("resolveHost", () => {
  const root = "giroa.app";

  it("raíz y www son la landing", () => {
    expect(resolveHost("giroa.app", root)).toEqual({ kind: "marketing" });
    expect(resolveHost("www.giroa.app", root)).toEqual({ kind: "marketing" });
    expect(resolveHost(null, root)).toEqual({ kind: "marketing" });
  });

  it("app. es la plataforma", () => {
    expect(resolveHost("app.giroa.app", root)).toEqual({ kind: "platform" });
  });

  it("api. y admin. están reservados", () => {
    expect(resolveHost("api.giroa.app", root)).toEqual({ kind: "reserved", subdomain: "api" });
    expect(resolveHost("admin.giroa.app", root)).toEqual({ kind: "reserved", subdomain: "admin" });
  });

  it("un subdominio válido es un estudio (sin importar mayúsculas)", () => {
    expect(resolveHost("tango-sur.giroa.app", root)).toEqual({ kind: "studio", slug: "tango-sur" });
    expect(resolveHost("Tango-Sur.Giroa.App", root)).toEqual({ kind: "studio", slug: "tango-sur" });
  });

  it("subdominios inválidos o anidados no son estudios", () => {
    expect(resolveHost("ab.giroa.app", root).kind).toBe("unknown");
    expect(resolveHost("-tango.giroa.app", root).kind).toBe("unknown");
    expect(resolveHost("a.b.giroa.app", root).kind).toBe("unknown");
  });

  it("no confunde dominios que terminan parecido", () => {
    expect(resolveHost("tango.notgiroa.app", root).kind).toBe("unknown");
    expect(resolveHost("evilgiroa.app", root).kind).toBe("unknown");
  });

  it("en desarrollo funciona con *.localhost y puerto", () => {
    const dev = "localhost:3000";
    expect(resolveHost("localhost:3000", dev)).toEqual({ kind: "marketing" });
    expect(resolveHost("app.localhost:3000", dev)).toEqual({ kind: "platform" });
    expect(resolveHost("tango-sur.localhost:3000", dev)).toEqual({ kind: "studio", slug: "tango-sur" });
  });
});

describe("decideRoute", () => {
  const root = "giroa.app";
  const studio = { kind: "studio", slug: "tango-sur" } as const;

  it("el estudio se reescribe a /s/[slug]", () => {
    expect(decideRoute(studio, "/", "", root, "https:")).toEqual({ type: "rewrite", pathname: "/s/tango-sur" });
    expect(decideRoute(studio, "/app/grilla", "", root, "https:")).toEqual({
      type: "rewrite",
      pathname: "/s/tango-sur/app/grilla",
    });
  });

  it("/api nunca se reescribe", () => {
    expect(decideRoute(studio, "/api/webhooks/mercadopago", "", root, "https:")).toEqual({ type: "next" });
  });

  it("/s/[slug] en otro host redirige al subdominio", () => {
    expect(decideRoute({ kind: "marketing" }, "/s/tango-sur/panel", "?x=1", root, "https:")).toEqual({
      type: "redirect",
      url: "https://tango-sur.giroa.app/panel?x=1",
    });
    expect(decideRoute({ kind: "platform" }, "/s/tango-sur", "", root, "https:")).toEqual({
      type: "redirect",
      url: "https://tango-sur.giroa.app/",
    });
  });

  it("/s/ con slug inválido es 404", () => {
    expect(decideRoute({ kind: "marketing" }, "/s/NO", "", root, "https:")).toEqual({ type: "not_found" });
  });

  it("subdominios reservados son 404", () => {
    expect(decideRoute({ kind: "reserved", subdomain: "admin" }, "/", "", root, "https:")).toEqual({
      type: "not_found",
    });
  });

  it("app. a secas lleva a elegir estudio", () => {
    expect(decideRoute({ kind: "platform" }, "/", "", root, "https:")).toEqual({
      type: "redirect",
      url: "https://app.giroa.app/estudios",
    });
  });

  it("landing y plataforma pasan derecho", () => {
    expect(decideRoute({ kind: "marketing" }, "/", "", root, "https:")).toEqual({ type: "next" });
    expect(decideRoute({ kind: "platform" }, "/login", "", root, "https:")).toEqual({ type: "next" });
  });
});
