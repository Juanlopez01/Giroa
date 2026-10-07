"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

export function CouponForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Código" hint="Lo que escriben al comprar. Ej.: PRIMAVERA20" error={errors.code}>
        <Input name="code" autoCapitalize="characters" autoComplete="off" className="uppercase" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Descuento" error={errors.kind}>
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "percent" | "amount")}>
            <option value="percent">Porcentaje</option>
            <option value="amount">Monto fijo</option>
          </Select>
        </Field>
        <Field label={kind === "percent" ? "Porcentaje" : "Monto"} error={errors.value}>
          <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface focus-within:border-brand">
            {kind === "amount" ? <span className="pl-4 text-muted">$</span> : null}
            <input
              name="value"
              inputMode="decimal"
              placeholder={kind === "percent" ? "20" : "5.000"}
              required
              className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            />
            {kind === "percent" ? <span className="pr-4 text-muted">%</span> : null}
          </div>
        </Field>
      </div>
      <Field label="Vale para" error={errors.appliesTo}>
        <Select name="appliesTo" defaultValue="all">
          <option value="all">Packs y entradas</option>
          <option value="packs">Solo packs</option>
          <option value="events">Solo entradas de eventos</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Usos en total" hint="Vacío = sin límite" error={errors.maxUses}>
          <Input name="maxUses" type="number" inputMode="numeric" min={1} />
        </Field>
        <Field label="Vale hasta" hint="Opcional, inclusive" error={errors.validUntil}>
          <Input name="validUntil" type="date" />
        </Field>
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="oncePerPerson" defaultChecked className="h-5 w-5 accent-[var(--brand)]" />
        <span>Una sola vez por persona</span>
      </label>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear código"}
      </Button>
    </ActionForm>
  );
}
