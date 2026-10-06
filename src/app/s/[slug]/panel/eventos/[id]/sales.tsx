"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { formatArs } from "@/lib/money";

/** Venta en la puerta: efectivo o transferencia. */
export function ManualSaleForm({
  types,
  action,
}: {
  types: { id: string; name: string; priceCents: number }[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Entrada" error={errors.ticketTypeId}>
        <Select name="ticketTypeId" required defaultValue={types[0]?.id}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.priceCents ? formatArs(t.priceCents) : "Gratis"}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[6rem_1fr] gap-4">
        <Field label="Cantidad" error={errors.quantity}>
          <Input name="quantity" type="number" inputMode="numeric" min={1} max={20} defaultValue={1} required />
        </Field>
        <Field label="Nombre" error={errors.name}>
          <Input name="name" placeholder="Quién compra" required />
        </Field>
      </div>
      <Field label="Email" hint="Opcional: si lo ponés, le llegan las entradas." error={errors.email}>
        <Input name="email" type="email" inputMode="email" />
      </Field>
      <fieldset className="flex gap-3">
        {(
          [
            ["cash", "Efectivo"],
            ["transfer", "Transferencia"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface p-3">
            <input type="radio" name="method" value={value} defaultChecked={value === "cash"} className="h-5 w-5 accent-[var(--brand)]" />
            {label}
          </label>
        ))}
      </fieldset>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Registrando…" : "Registrar venta"}
      </Button>
    </ActionForm>
  );
}

export function CancelOrderButton({ cancel }: { cancel: () => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  if (result?.ok) return <span className="text-xs text-muted">Cancelada</span>;
  return (
    <span className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("¿Cancelar esta compra? Sus entradas dejan de valer. El reintegro, si corresponde, lo hacés vos.")) {
            startTransition(async () => setResult(await cancel()));
          }
        }}
        className="text-xs font-medium text-muted hover:text-danger disabled:opacity-50"
      >
        {pending ? "Cancelando…" : "Cancelar"}
      </button>
      {result && !result.ok ? <span className="block text-xs text-danger">{result.message}</span> : null}
    </span>
  );
}
