"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import type { ActionState } from "@/lib/errors";
import type { RuleInput } from "../actions";

const KINDS = [
  { value: "per_class", label: "Fijo por clase", prefix: "$" },
  { value: "per_student", label: "Por alumno presente", prefix: "$" },
  { value: "percent", label: "% de lo que generó la clase", prefix: "%" },
] as const;

/** Los profes de una clase y lo que cobra cada uno. */
export function RulesEditor({
  initial,
  suggested,
  team,
  save,
}: {
  initial: RuleInput[];
  /** Si todavía no tiene reglas: el profe de la clase, para no escribirlo de nuevo. */
  suggested: RuleInput | null;
  team: { id: string; name: string }[];
  save: (rules: RuleInput[]) => Promise<ActionState>;
}) {
  const [rows, setRows] = useState<RuleInput[]>(initial.length ? initial : suggested ? [suggested] : []);
  const [dirty, setDirty] = useState(!initial.length && Boolean(suggested));
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (i: number, patch: Partial<RuleInput>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
    setResult(null);
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-sm text-muted">Sin profes: esta clase no se liquida.</p> : null}
      {rows.map((r, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            {team.length ? (
              <Select
                aria-label="Profe del equipo"
                value={r.memberId}
                onChange={(e) => {
                  const m = team.find((t) => t.id === e.target.value);
                  update(i, { memberId: e.target.value, payeeName: m ? m.name : r.memberId ? "" : r.payeeName });
                }}
                className="flex-1"
              >
                <option value="">Sin cuenta en Giroa</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setRows((rs) => rs.filter((_, j) => j !== i));
                setDirty(true);
              }}
              aria-label="Quitar profe"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:text-danger"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {!r.memberId ? (
            <Input aria-label="Nombre del profe" placeholder="Nombre del profe" value={r.payeeName} onChange={(e) => update(i, { payeeName: e.target.value })} maxLength={120} />
          ) : null}
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <Select aria-label="Cómo cobra" value={r.kind} onChange={(e) => update(i, { kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            <Input
              aria-label={r.kind === "percent" ? "Porcentaje" : "Monto en pesos"}
              inputMode="decimal"
              placeholder={r.kind === "percent" ? "30 %" : "$ 15.000"}
              value={r.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setRows((rs) => [...rs, { payeeName: "", memberId: "", kind: "per_class", value: "" }]);
            setDirty(true);
          }}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand"
        >
          <Plus className="h-4 w-4" aria-hidden /> Agregar profe
        </button>
        {dirty ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await save(rows);
                setResult(r);
                if (r.ok) setDirty(false);
              })
            }
            className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-foreground disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        ) : null}
      </div>
      {!initial.length && suggested && dirty ? <p className="text-xs text-muted">Sugerido: el profe de la clase. Completá el monto y guardá.</p> : null}
      {result?.message ? <p className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p> : null}
    </div>
  );
}
