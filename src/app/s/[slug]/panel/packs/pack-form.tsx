"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import type { PackRules } from "@/lib/pack-rules";

export type PackFormValues = {
  name: string;
  description: string;
  credits: number | null;
  validityDays: number;
  price: string;
  isCouple: boolean;
  isMembership?: boolean;
  rules?: PackRules;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: PackFormValues;
  allowCouple: boolean;
  submitLabel: string;
  /** El plan incluye abonos mensuales. */
  allowMembership?: boolean;
  /** Opciones para las restricciones (null si el plan no las incluye). */
  ruleOptions?: { disciplines: { key: string; name: string }[]; offerings: { id: string; title: string }[] } | null;
};

export function PackForm({ action, initial, allowCouple, submitLabel, allowMembership = false, ruleOptions = null }: Props) {
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

      {allowMembership ? (
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <input
            type="checkbox"
            name="isMembership"
            defaultChecked={initial?.isMembership}
            className="mt-1 h-5 w-5 accent-[var(--brand)]"
          />
          <span>
            <span className="block font-medium">Abono mensual</span>
            <span className="block text-sm text-muted">
              Tus alumnos se pueden abonar: Mercado Pago les cobra el precio todos los meses y cada cobro les carga
              las clases del mes. Lo que no usan no se acumula. Si después cambiás el precio, los abonos que ya
              existen siguen con el precio anterior.
            </span>
          </span>
        </label>
      ) : null}

      <Field label="Descripción" hint="Opcional. La ven tus alumnos al comprar." error={errors.description}>
        <Textarea name="description" defaultValue={initial?.description} rows={2} />
      </Field>

      {ruleOptions ? <RulesFields options={ruleOptions} initial={initial?.rules ?? {}} error={errors.ruleFrom} /> : null}

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}

const WEEK = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mié"],
  [4, "Jue"],
  [5, "Vie"],
  [6, "Sáb"],
  [0, "Dom"],
] as const;

const chip =
  "inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-brand-foreground";

/** "Solo yoga", "Lunes a viernes", "Antes de las 17". Vacío = vale para todo. */
function RulesFields({
  options,
  initial,
  error,
}: {
  options: NonNullable<Props["ruleOptions"]>;
  initial: PackRules;
  error?: string;
}) {
  const open = Boolean(initial.disciplines || initial.offerings || initial.weekdays || initial.from || initial.until);
  return (
    <details open={open} className="rounded-2xl border border-border bg-surface p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none font-medium">
        Restricciones <span className="font-normal text-muted">(opcional)</span>
        <span className="block text-sm font-normal text-muted">Para packs como “Solo yoga”, “Lunes a viernes” o “Antes de las 17”.</span>
      </summary>
      <div className="mt-4 space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Vale para estas disciplinas</legend>
          <div className="flex flex-wrap gap-2">
            {options.disciplines.map((d) => (
              <label key={d.key} className={chip}>
                <input type="checkbox" name="ruleDiscipline" value={d.key} defaultChecked={initial.disciplines?.includes(d.key)} className="sr-only" />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        {options.offerings.length ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">…o para estas clases</legend>
            <div className="flex flex-wrap gap-2">
              {options.offerings.map((o) => (
                <label key={o.id} className={chip}>
                  <input type="checkbox" name="ruleOffering" value={o.id} defaultChecked={initial.offerings?.includes(o.id)} className="sr-only" />
                  {o.title}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">Si no marcás ninguna disciplina ni clase, vale para todas.</p>
          </fieldset>
        ) : null}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Días</legend>
          <div className="flex flex-wrap gap-2">
            {WEEK.map(([n, label]) => (
              <label key={n} className={chip}>
                <input type="checkbox" name="ruleWeekday" value={n} defaultChecked={initial.weekdays?.includes(n)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">Sin marcar = todos los días.</p>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Clases desde las" hint="Opcional" error={error}>
            <Input type="time" name="ruleFrom" defaultValue={initial.from} />
          </Field>
          <Field label="Hasta las" hint="Opcional">
            <Input type="time" name="ruleUntil" defaultValue={initial.until} />
          </Field>
        </div>
        <p className="text-xs text-muted">Cuenta la hora a la que empieza la clase. Los packs ya vendidos no cambian.</p>
      </div>
    </details>
  );
}
