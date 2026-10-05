import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { parseDate, parseStudentImport } from "@/lib/student-import";

describe("parseCsv", () => {
  it("separa por punto y coma (Excel en castellano) y respeta comillas", () => {
    expect(parseCsv('Nombre;Mail\r\n"Pérez; Ana";ana@x.com\r\n')).toEqual([
      ["Nombre", "Mail"],
      ["Pérez; Ana", "ana@x.com"],
    ]);
  });

  it("separa por coma y por tab", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("comillas escapadas, BOM y filas vacías", () => {
    expect(parseCsv('﻿x\n"dijo ""hola"""\n\n,,\n')).toEqual([["x"], ['dijo "hola"']]);
  });
});

describe("parseDate", () => {
  it("entiende los formatos habituales", () => {
    expect(parseDate("12/11/2026")).toBe("2026-11-12");
    expect(parseDate("1/2/27")).toBe("2027-02-01");
    expect(parseDate("2026-11-12")).toBe("2026-11-12");
    expect(parseDate("12-11-2026")).toBe("2026-11-12");
  });

  it("rechaza fechas imposibles", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("mañana")).toBeNull();
  });
});

describe("parseStudentImport", () => {
  const csv = [
    "Nombre;Apellido;Mail;Celular;Rol;Clases;Vence",
    "Ana;Pérez;ANA@x.com;11 5555;Líder;6;12/11/2026",
    "Beto;Gómez;;;seguidor;libre;30/11/2026",
    ";;sin@nombre.com;;;;",
    "Carla;Ruiz;carla@;;bailarina;muchas;",
    "Dani;López;;;;;",
  ].join("\n");

  it("reconoce columnas con nombres variados y une nombre + apellido", () => {
    const res = parseStudentImport(csv);
    if (!res.ok) throw new Error(res.error);
    expect(res.rows[0]?.data).toEqual({
      row: 1,
      full_name: "Ana Pérez",
      email: "ana@x.com",
      phone: "11 5555",
      default_role: "leader",
      credits: 6,
      unlimited: false,
      expires_on: "2026-11-12",
    });
    expect(res.rows[1]?.data?.unlimited).toBe(true);
    expect(res.rows[4]?.data?.credits).toBeNull();
  });

  it("marca los errores por fila sin frenar las demás", () => {
    const res = parseStudentImport(csv);
    if (!res.ok) throw new Error(res.error);
    expect(res.rows[2]?.errors).toEqual(["Falta el nombre."]);
    expect(res.rows[3]?.errors).toEqual([
      "El email no es válido.",
      "El rol tiene que ser líder o seguidor/a.",
      "Las clases tienen que ser un número (o “libre”).",
    ]);
    expect(res.rows.filter((r) => r.data).length).toBe(3);
  });

  it("pide la columna del nombre", () => {
    const res = parseStudentImport("Mail\nana@x.com");
    expect(res.ok).toBe(false);
  });

  it("avisa si hay saldo sin vencimiento", () => {
    const res = parseStudentImport("Nombre y apellido,Clases\nAna Pérez,4");
    if (!res.ok) throw new Error(res.error);
    expect(res.rows[0]?.errors).toEqual(["Tiene saldo pero falta la fecha de vencimiento."]);
  });
});
