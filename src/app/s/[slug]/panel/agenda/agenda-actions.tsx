"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";

export function CancelSessionButton({
  label,
  cancel,
}: {
  label: string;
  cancel: (reason: string) => Promise<ActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  if (result?.ok) return <span className="text-xs text-muted">Cancelada</span>;

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const reason = prompt(
            `¿Cancelar ${label}? A los anotados se les devuelve la clase y les avisamos.\n\nMotivo (opcional):`,
          );
          if (reason === null) return;
          startTransition(async () => setResult(await cancel(reason)));
        }}
        className="text-sm text-danger hover:underline disabled:opacity-50"
      >
        {pending ? "…" : "Cancelar"}
      </button>
      {result && !result.ok ? <p className="max-w-40 text-xs text-danger">{result.message}</p> : null}
    </div>
  );
}

export function GenerateButton({ generate }: { generate: () => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await generate()))}
        className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
      >
        {pending ? "Armando la grilla…" : "Armar las próximas 4 semanas"}
      </button>
      {result ? <p className={`text-sm ${result.ok ? "text-muted" : "text-danger"}`}>{result.message}</p> : null}
    </div>
  );
}
