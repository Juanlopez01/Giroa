import { describe, expect, it } from "vitest";
import { csvMoney, toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("separa con ; y abre con BOM", () => {
    const csv = toCsv(["Nombre", "Activo"], [["Ana", true]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Nombre;Activo\r\nAna;Sí\r\n");
  });
  it("escapa comillas, ; y saltos de línea", () => {
    expect(toCsv(["x"], [['Dice "hola"; chau']])).toContain('"Dice ""hola""; chau"');
  });
  it("no deja pasar fórmulas", () => {
    expect(toCsv(["x"], [["=HYPERLINK(1)"]])).toContain("'=HYPERLINK(1)");
  });
  it("plata con coma decimal", () => {
    expect(csvMoney(1234550)).toBe("12345,50");
  });
});
