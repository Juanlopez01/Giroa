"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { formatArs } from "@/lib/money";

export type BuyOption = {
  id: string;
  name: string;
  priceCents: number;
  remaining: number | null;
  maxPerOrder: number;
  onSale: boolean;
  offline: boolean;
};

type Props = {
  options: BuyOption[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults: { name: string; email: string; phone: string };
};

export function BuyForm({ options, action, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const isAvailable = (o: BuyOption) => o.onSale && !o.offline && o.remaining !== 0;
  const available = options.filter(isAvailable);
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const selected = options.find((o) => o.id === selectedId);
  const max = selected ? Math.min(selected.maxPerOrder, selected.remaining ?? selected.maxPerOrder) : 1;
  const qty = Math.min(quantity, max);
  const total = (selected?.priceCents ?? 0) * qty;
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Entrada</legend>
        {options.map((o) => {
          const disabled = !isAvailable(o);
          return (
            <label
              key={o.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border bg-surface p-4 ${
                selectedId === o.id ? "border-brand ring-2 ring-brand/20" : "border-border"
              } ${disabled ? "opacity-50" : "cursor-pointer"}`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="ticketTypeId"
                  value={o.id}
                  checked={selectedId === o.id}
                  disabled={disabled}
                  onChange={() => setSelectedId(o.id)}
                  className="h-5 w-5 accent-[var(--brand)]"
                />
                <span>
                  <span className="block font-medium">{o.name}</span>
                  <span className="block text-sm text-muted">
                    {o.remaining === 0
                      ? "Agotada"
                      : !o.onSale
                        ? "Terminó la venta"
                        : o.offline
                          ? "Se consigue en el estudio"
                        : o.remaining !== null && o.remaining <= 10
                          ? `¡Quedan ${o.remaining}!`
                          : null}
                  </span>
                </span>
              </span>
              <span className="font-semibold tabular-nums">{o.priceCents ? formatArs(o.priceCents) : "Gratis"}</span>
            </label>
          );
        })}
        {errors.ticketTypeId ? <p className="text-sm text-danger">{errors.ticketTypeId}</p> : null}
      </fieldset>

      {available.length ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, qty - 1))}
                disabled={qty <= 1}
                className="h-11 w-11 rounded-xl border border-border bg-surface text-xl disabled:opacity-40"
                aria-label="Una menos"
              >
                −
              </button>
              <span className="w-6 text-center text-lg font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(max, qty + 1))}
                disabled={qty >= max}
                className="h-11 w-11 rounded-xl border border-border bg-surface text-xl disabled:opacity-40"
                aria-label="Una más"
              >
                +
              </button>
            </div>
            <input type="hidden" name="quantity" value={qty} />
          </div>

          <Field label="Nombre y apellido" error={errors.name}>
            <Input name="name" defaultValue={defaults.name} autoComplete="name" required />
          </Field>
          <Field label="Email" hint="Ahí te mandamos las entradas." error={errors.email}>
            <Input name="email" type="email" defaultValue={defaults.email} autoComplete="email" inputMode="email" required />
          </Field>
          <Field label="Celular" hint="Opcional, por si el estudio necesita avisarte algo." error={errors.phone}>
            <Input name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" inputMode="tel" />
          </Field>

          <FormMessage ok={false} message={state.message} />
          <Button type="submit" disabled={pending || !selected}>
            {pending
              ? total
                ? "Abriendo Mercado Pago…"
                : "Confirmando…"
              : total
                ? `Pagar ${formatArs(total)} con Mercado Pago`
                : qty === 1
                  ? "Quiero mi entrada"
                  : `Quiero mis ${qty} entradas`}
          </Button>
          {total ? (
            <p className="text-center text-xs text-muted">Te guardamos los lugares 20 minutos mientras pagás.</p>
          ) : null}
        </>
      ) : (
        <p className="rounded-xl bg-border/50 px-4 py-3 text-center font-medium">No hay entradas disponibles.</p>
      )}
    </ActionForm>
  );
}
