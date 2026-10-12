"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";

/** "Congelar" con fecha opcional para descongelar solo. */
export function FreezeButton({ freeze, minDate }: { freeze: (until: string | null) => Promise<ActionState>; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand hover:underline">
        Congelar
      </button>
    );
  }
  return (
    <div className="mt-3 w-full space-y-2 rounded-xl bg-background p-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Congelado hasta (opcional)</span>
        <input
          type="date"
          min={minDate}
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
        />
        <span className="block text-xs text-muted">Si no ponés fecha, lo descongelás vos cuando vuelva.</span>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setResult(await freeze(until || null)))}
          className="h-10 rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending ? "Congelando…" : "Congelar pack"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full px-3 text-sm text-muted">
          Cancelar
        </button>
      </div>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}

export function UnfreezeButton({ unfreeze }: { unfreeze: () => Promise<ActionState> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await unfreeze()))}
        className="h-9 rounded-full border border-border bg-surface px-3 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "…" : "Descongelar"}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
