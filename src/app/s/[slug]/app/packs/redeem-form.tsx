"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { FormMessage } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

export function RedeemGiftForm({
  action,
  initialCode,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initialCode: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [open, setOpen] = useState(Boolean(initialCode));
  if (state.ok) {
    return (
      <div className="space-y-2">
        <FormMessage ok message={state.message} />
        <Link href="/app/clases" className="font-medium text-brand">
          Reservar una clase →
        </Link>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand">
        🎁 Tengo un código de regalo
      </button>
    );
  }
  return (
    <ActionForm action={formAction} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <p className="font-medium">Canjeá tu regalo</p>
      <div className="flex gap-2">
        <input
          name="code"
          defaultValue={initialCode}
          placeholder="REGALO-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 font-mono text-base uppercase outline-none focus:border-brand"
          aria-label="Código de regalo"
        />
        <button type="submit" disabled={pending} className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-medium text-brand-foreground disabled:opacity-50">
          {pending ? "…" : "Canjear"}
        </button>
      </div>
      {state.fieldErrors?.code ? <p className="text-sm text-danger">{state.fieldErrors.code}</p> : null}
      <FormMessage ok={false} message={state.message} />
    </ActionForm>
  );
}
