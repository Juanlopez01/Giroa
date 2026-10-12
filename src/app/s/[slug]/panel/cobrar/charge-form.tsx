"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

const METHODS = [
  ["cash", "Efectivo"],
  ["transfer", "Transferencia"],
] as const;

/** Formulario de una venta: los campos propios (children) + cómo pagó + confirmar. */
export function ChargeForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [round, setRound] = useState(0);
  const lastOk = useRef<ActionState | null>(null);
  // Después de cobrar, el formulario queda limpio para la próxima venta.
  useEffect(() => {
    if (state.ok && state !== lastOk.current) {
      lastOk.current = state;
      setRound((r) => r + 1);
    }
  }, [state]);

  return (
    <div className="space-y-3">
      <ActionForm key={round} action={formAction} className="space-y-4">
        {children}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">¿Cómo pagó?</legend>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(([value, label], i) => (
              <label
                key={value}
                className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-brand-foreground"
              >
                <input type="radio" name="method" value={value} defaultChecked={i === 0} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {state.fieldErrors?.method ? <p className="text-sm text-danger">{state.fieldErrors.method}</p> : null}
        </fieldset>
        {!state.ok ? <FormMessage ok={false} message={state.message} /> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Cobrando…" : submitLabel}
        </Button>
      </ActionForm>
      {state.ok && !pending ? <FormMessage ok message={state.message} /> : null}
    </div>
  );
}

/** Cobrar algo pendiente con un toque: efectivo o transferencia. */
export function PayPendingButtons({ pay }: { pay: (method: "cash" | "transfer") => Promise<ActionState> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  if (result?.ok) return <p className="text-sm font-medium text-success">{result.message}</p>;
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {METHODS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={pending}
            onClick={() => start(async () => setResult(await pay(value)))}
            className="h-9 rounded-full border border-border bg-surface px-3 text-xs font-semibold hover:border-brand disabled:opacity-60"
          >
            {pending ? "…" : label}
          </button>
        ))}
      </div>
      {result && !result.ok ? <p className="text-xs text-danger">{result.message}</p> : null}
    </div>
  );
}
