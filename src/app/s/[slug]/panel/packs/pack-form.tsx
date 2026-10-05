"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

export type PackFormValues = {
  name: string;
  description: string;
  credits: number | null;
  validityDays: number;
  price: string;
  isCouple: boolean;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: PackFormValues;
  allowCouple: boolean;
  submitLabel: string;
};

export function PackForm({ action, initial, allowCouple, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [unlimited, setUnlimited] = useState(initial ? initial.credits === null : false);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      <Field label="Nombre del pack" error={errors.name}>
        <Input name="name" defaultValue={initial?.name} placeholder="Ej.: 8 clases mensual" required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Clases" error={errors.credits} hint={unlimited ? "Sin límite de clases." : undefined}>
          <Input
            name="credits"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            defaultValue={initial?.credits ?? 8}
            disabled={unlimited}
            aria-invalid={Boolean(errors.credits)}
          />
        </Field>
        <Field label="Validez (días)" error={errors.validityDays}>
          <Input
            name="validityDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={730}
            defaultValue={initial?.validityDays ?? 30}
            required
          />
        </Field>
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="unlimited"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
          className="h-5 w-5 accent-[var(--brand)]"
        />
        <span>Clases libres (ilimitado durante la validez)</span>
      </label>

      <Field label="Precio" hint="En pesos. Por ejemplo 29.900" error={errors.price}>
        <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
          <span className="pl-4 text-base text-muted">$</span>
          <input
            name="price"
            defaultValue={initial?.price}
            inputMode="decimal"
            placeholder="29.900"
            required
            className="h-12 min-w-0 flex-1 bg-transparent px-2 text-base outline-none"
            aria-invalid={Boolean(errors.price)}
          />
        </div>
      </Field>

      {allowCouple ? (
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <input
            type="checkbox"
            name="isCouple"
            defaultChecked={initial?.isCouple}
            className="mt-1 h-5 w-5 accent-[var(--brand)]"
          />
          <span>
            <span className="block font-medium">Pack de pareja</span>
            <span className="block text-sm text-muted">
              Dos alumnos comparten el mismo saldo de clases. A la pareja la asignás al registrar el pago.
            </span>
          </span>
        </label>
      ) : null}

      <Field label="Descripción" hint="Opcional. La ven tus alumnos al comprar." error={errors.description}>
        <Textarea name="description" defaultValue={initial?.description} rows={2} />
      </Field>

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}
