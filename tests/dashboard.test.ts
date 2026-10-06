import { describe, expect, it } from "vitest";
import { whatsappLink } from "@/lib/dashboard.server";

describe("link de WhatsApp", () => {
  it("arma el número argentino con 549", () => {
    expect(whatsappLink("11 5555-5555", "Hola")).toBe("https://wa.me/5491155555555?text=Hola");
    expect(whatsappLink("011 5555 5555", "Hola")).toBe("https://wa.me/5491155555555?text=Hola");
  });

  it("respeta números que ya vienen completos", () => {
    expect(whatsappLink("+54 9 11 5555-5555", "x")).toBe("https://wa.me/5491155555555?text=x");
  });

  it("codifica el mensaje y descarta números inválidos", () => {
    expect(whatsappLink("1155555555", "¡Hola Ana!")).toContain("text=%C2%A1Hola%20Ana!");
    expect(whatsappLink(null, "x")).toBeNull();
    expect(whatsappLink("1234", "x")).toBeNull();
  });
});
