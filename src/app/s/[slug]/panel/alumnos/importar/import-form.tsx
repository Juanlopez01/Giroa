"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/field";
import { parseStudentImport } from "@/lib/student-import";
import type { ImportResult } from "../actions";

const TEMPLATE =
  "Nombre;Apellido;Mail;Celular;Rol;Clases;Vence\n" +
  "Ana;Pérez;ana@ejemplo.com;11 5555-5555;Líder;6;30/11/2026\n" +
  "Beto;Gómez;beto@ejemplo.com;;Seguidor;Libre;15/11/2026\n" +
  "Carla;Ruiz;;11 4444-4444;;;\n";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function ImportForm({ importAction }: { importAction: (rowsJson: string) => Promise<ImportResult> }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => (text.trim() ? parseStudentImport(text) : null), [text]);
  const valid = parsed?.ok ? parsed.rows.filter((r) => r.data) : [];
  const invalid = parsed?.ok ? parsed.rows.filter((r) => !r.data) : [];

  function downloadTemplate() {
    const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-alumnos-giroa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (result?.ok) {
    return (
      <div className="space-y-5">
        <FormMessage
          ok
          message={`Listo: ${plural(result.created ?? 0, "alumno nuevo", "alumnos nuevos")}, ${plural(result.updated ?? 0, "actualizado", "actualizados")} y ${plural(result.packs ?? 0, "saldo cargado", "saldos cargados")}.`}
        />
        {result.errors?.length ? (
          <div className="space-y-2">
            <p className="font-medium">Estas filas no se importaron:</p>
            <ul className="space-y-1 text-sm">
              {result.errors.map((e) => (
                <li key={e.row}>
                  <span className="font-medium">Fila {e.row}:</span> {e.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Link href="/panel/alumnos" className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-medium text-brand-foreground">
          Ver alumnos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 text-sm">
        <p>
          Exportá tu planilla de Excel como <span className="font-medium">CSV</span> (Archivo → Guardar como → CSV). La
          primera fila tiene que tener los títulos. Reconocemos: <span className="font-medium">Nombre</span> (o Nombre y
          apellido), Apellido, Mail, Celular, Rol, Clases (número o “Libre”) y Vence (dd/mm/aaaa).
        </p>
        <button type="button" onClick={downloadTemplate} className="font-medium text-brand hover:underline">
          Descargar un modelo
        </button>
      </div>

      <label className="flex h-14 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-surface text-sm text-muted hover:border-foreground">
        {fileName ?? "Elegí el archivo CSV"}
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            setResult(null);
            setText(await file.text());
          }}
        />
      </label>

      <details>
        <summary className="cursor-pointer text-sm text-muted">O pegá las filas acá</summary>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={6}
          className="mt-2 font-mono text-sm"
          placeholder={TEMPLATE}
        />
      </details>

      {parsed && !parsed.ok ? <FormMessage ok={false} message={parsed.error} /> : null}

      {parsed?.ok ? (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium text-success">{valid.length} listas para importar</span>
            {invalid.length ? <span className="text-danger"> · {invalid.length} con errores</span> : null}
          </p>

          {invalid.length ? (
            <ul className="space-y-1 rounded-xl bg-danger/10 p-3 text-sm text-danger">
              {invalid.slice(0, 20).map((r) => (
                <li key={r.row}>
                  <span className="font-medium">Fila {r.row}</span>
                  {Object.values(r.raw).find(Boolean) ? ` (${Object.values(r.raw).filter(Boolean).slice(0, 2).join(" ")})` : ""}:{" "}
                  {r.errors.join(" ")}
                </li>
              ))}
              {invalid.length > 20 ? <li>…y {invalid.length - 20} más.</li> : null}
            </ul>
          ) : null}

          {valid.length ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {valid.slice(0, 8).map((r) => (
                    <tr key={r.row}>
                      <td className="px-3 py-2">{r.data?.full_name}</td>
                      <td className="px-3 py-2 text-muted">{r.data?.email ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.data?.unlimited ? "Libre" : r.data?.credits ? `${r.data.credits} clases` : "—"}
                        {r.data?.expires_on ? ` · ${r.data.expires_on.split("-").reverse().slice(0, 2).join("/")}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {valid.length > 8 ? <p className="px-3 py-2 text-sm text-muted">…y {valid.length - 8} más.</p> : null}
            </div>
          ) : null}

          {result && !result.ok ? <FormMessage ok={false} message={result.message} /> : null}

          <Button
            type="button"
            disabled={pending || valid.length === 0}
            onClick={() =>
              startTransition(async () => setResult(await importAction(JSON.stringify(valid.map((r) => r.data)))))
            }
          >
            {pending ? "Importando…" : `Importar ${valid.length} ${valid.length === 1 ? "alumno" : "alumnos"}`}
          </Button>
          <p className="text-sm text-muted">
            Si un email ya existe en el estudio, no se duplica: se le suma el saldo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
