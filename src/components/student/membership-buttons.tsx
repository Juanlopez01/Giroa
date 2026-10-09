"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";

/** "Abonarme · $30.000 por mes": abre MP para autorizar el débito. */
export function StartMembershipButton({ start, label }: { start: () => Promise<ActionState>; label: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await start()))}
        className="h-12 w-full rounded-full bg-brand text-sm font-semibold text-brand-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Abriendo Mercado Pago…" : label}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}

/** Dar de baja, con confirmación. */
export function CancelMembershipButton({
  cancel,
  question,
  label = "Dar de baja el abono",
}: {
  cancel: () => Promise<ActionState>;
  question: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  if (result?.ok) return <p className="text-sm text-muted">{result.message}</p>;
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(question)) startTransition(async () => setResult(await cancel()));
        }}
        className="text-sm font-medium text-muted hover:text-danger disabled:opacity-50"
      >
        {pending ? "Dando de baja…" : label}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
