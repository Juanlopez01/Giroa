"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";

/** Botones de una acción con resultado al lado (aprobar, cobrar, presente…). */
export function ActionButtons({
  buttons,
}: {
  buttons: { label: string; run: () => Promise<ActionState>; tone?: "primary" | "muted" | "danger"; confirm?: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  if (result?.ok) return <span className="text-sm text-success">{result.message}</span>;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex flex-wrap justify-end gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            disabled={pending}
            onClick={() => {
              if (b.confirm && !confirm(b.confirm)) return;
              startTransition(async () => setResult(await b.run()));
            }}
            className={`h-9 rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${
              b.tone === "primary"
                ? "bg-brand text-brand-foreground"
                : b.tone === "danger"
                  ? "text-muted hover:text-danger"
                  : "border border-border bg-surface"
            }`}
          >
            {pending ? "…" : b.label}
          </button>
        ))}
      </span>
      {result && !result.ok ? <span className="max-w-60 text-right text-xs text-danger">{result.message}</span> : null}
    </span>
  );
}

/** Nota de una evaluación: aprobado/desaprobado o número del 1 al 10. */
export function GradeInput({
  kind,
  initial,
  save,
}: {
  kind: "grade" | "pass_fail";
  initial: { grade: number | null; passed: boolean | null };
  save: (value: { grade: number | null; passed: boolean | null }) => Promise<ActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<ActionState | null>(null);
  const run = (v: { grade: number | null; passed: boolean | null }) => {
    setValue(v);
    startTransition(async () => setMsg(await save(v)));
  };
  if (kind === "pass_fail") {
    return (
      <span className="inline-flex items-center gap-1">
        {([true, false] as const).map((p) => (
          <button
            key={String(p)}
            type="button"
            disabled={pending}
            aria-pressed={value.passed === p}
            onClick={() => run({ grade: null, passed: p })}
            className="h-8 rounded-lg border border-border px-2 text-xs font-medium aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground"
          >
            {p ? "Aprobado" : "Desaprobado"}
          </button>
        ))}
        {msg && !msg.ok ? <span className="text-xs text-danger">{msg.message}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={10}
        step={0.5}
        defaultValue={value.grade ?? ""}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && n >= 0 && n <= 10 && n !== value.grade) run({ grade: n, passed: null });
        }}
        className="h-8 w-16 rounded-lg border border-border bg-surface px-2 text-sm"
        aria-label="Nota"
      />
      {pending ? <span className="text-xs text-muted">…</span> : msg?.ok ? <span className="text-xs text-success">✓</span> : null}
    </span>
  );
}
