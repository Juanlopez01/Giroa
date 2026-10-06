"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

/** Botones de estado del evento (publicar, borrador, cancelar, borrar). */
export function EventStatusControls({
  status,
  hasOrders,
  setStatus,
  remove,
}: {
  status: "draft" | "published" | "cancelled";
  hasOrders: boolean;
  setStatus: (status: "draft" | "published" | "cancelled") => Promise<ActionState>;
  remove: () => Promise<ActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const run = (fn: () => Promise<ActionState>) => startTransition(async () => setResult(await fn()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {status !== "published" ? (
          <Button type="button" disabled={pending} onClick={() => run(() => setStatus("published"))}>
            {status === "cancelled" ? "Volver a publicar" : "Publicar evento"}
          </Button>
        ) : null}
        {status === "published" && !hasOrders ? (
          <button type="button" disabled={pending} onClick={() => run(() => setStatus("draft"))} className="text-sm font-medium text-muted hover:text-foreground">
            Pasar a borrador
          </button>
        ) : null}
        {status === "published" && hasOrders ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("¿Cancelar el evento? Se frena la venta. Las entradas vendidas no se reintegran solas.")) {
                run(() => setStatus("cancelled"));
              }
            }}
            className="text-sm font-medium text-muted hover:text-danger"
          >
            Cancelar evento
          </button>
        ) : null}
        {!hasOrders ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("¿Borrar este evento? No se puede deshacer.")) run(remove);
            }}
            className="text-sm font-medium text-muted hover:text-danger"
          >
            Borrar
          </button>
        ) : null}
      </div>
      {result?.message ? <FormMessage ok={result.ok} message={result.message} /> : null}
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 pl-4">
      <p className="min-w-0 flex-1 truncate text-sm">{url}</p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="h-9 shrink-0 rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground"
      >
        {copied ? "¡Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}

export type TicketTypeValues = {
  name: string;
  price: string;
  quantity: string;
  maxPerOrder: number;
  salesEndDate: string;
};

export function TicketTypeForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: TicketTypeValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Nombre" error={errors.name}>
        <Input name="name" defaultValue={initial?.name} placeholder="Ej.: Anticipada" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Precio" hint="0 si es gratis" error={errors.price}>
          <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <span className="pl-4 text-base text-muted">$</span>
            <input
              name="price"
              defaultValue={initial?.price}
              inputMode="decimal"
              placeholder="5.000"
              required
              className="h-12 min-w-0 flex-1 bg-transparent px-2 text-base outline-none"
              aria-invalid={Boolean(errors.price)}
            />
          </div>
        </Field>
        <Field label="Cupo" hint="Vacío = sin límite" error={errors.quantity}>
          <Input name="quantity" type="number" inputMode="numeric" min={1} defaultValue={initial?.quantity} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Máximo por compra" error={errors.maxPerOrder}>
          <Input name="maxPerOrder" type="number" inputMode="numeric" min={1} max={20} defaultValue={initial?.maxPerOrder ?? 10} required />
        </Field>
        <Field label="Se vende hasta" hint="Opcional, inclusive" error={errors.salesEndDate}>
          <Input name="salesEndDate" type="date" defaultValue={initial?.salesEndDate} />
        </Field>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}
