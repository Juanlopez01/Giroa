"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { formatArs } from "@/lib/money";

export type GiftOption = { id: string; name: string; summary: string; priceCents: number };

export function GiftForm({
  options,
  action,
}: {
  options: GiftOption[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const price = options.find((o) => o.id === selected)?.priceCents ?? 0;
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">¿Qué querés regalar?</legend>
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-surface p-4 ${
              selected === o.id ? "border-brand ring-2 ring-brand/20" : "border-border"
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="packProductId"
                value={o.id}
                checked={selected === o.id}
                onChange={() => setSelected(o.id)}
                className="h-5 w-5 accent-[var(--brand)]"
              />
              <span>
                <span className="block font-medium">{o.name}</span>
                <span className="block text-sm text-muted">{o.summary}</span>
              </span>
            </span>
            <span className="font-semibold tabular-nums">{formatArs(o.priceCents)}</span>
          </label>
        ))}
        {errors.packProductId ? <p className="text-sm text-danger">{errors.packProductId}</p> : null}
      </fieldset>

      <Field label="¿Para quién es?" hint="Opcional. Aparece en la tarjeta." error={errors.recipientName}>
        <Input name="recipientName" placeholder="Ej.: Lía" />
      </Field>
      <Field label="Mensaje" hint="Opcional." error={errors.message}>
        <Textarea name="message" rows={3} maxLength={500} placeholder="¡Feliz cumple! Para que vuelvas a bailar." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tu nombre" error={errors.buyerName}>
          <Input name="buyerName" autoComplete="name" required />
        </Field>
        <Field label="Tu email" hint="Ahí te mandamos la tarjeta." error={errors.buyerEmail}>
          <Input name="buyerEmail" type="email" inputMode="email" autoComplete="email" required />
        </Field>
      </div>

      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending || !selected}>
        {pending ? "Abriendo Mercado Pago…" : `Pagar ${formatArs(price)} con Mercado Pago`}
      </Button>
      <p className="text-center text-xs text-muted">
        Recibís una tarjeta con un código para compartir. Vale 12 meses y las clases corren desde que se canjea.
      </p>
    </ActionForm>
  );
}
