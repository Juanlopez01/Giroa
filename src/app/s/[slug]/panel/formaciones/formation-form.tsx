"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { formatArs, parseArsToCents } from "@/lib/money";

export type FormationValues = {
  title: string;
  description: string;
  startsOn: string;
  endsOn: string;
  capacity: string;
  requiresApproval: boolean;
  enrollmentFee: string;
  installmentsCount: number;
  installment: string;
  firstDueOn: string;
  fullPayment: string;
  minAttendance: number;
};

function MoneyInput({ name, defaultValue, placeholder, onChange }: { name: string; defaultValue?: string; placeholder?: string; onChange?: (v: string) => void }) {
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      <span className="pl-4 text-base text-muted">$</span>
      <input
        name={name}
        defaultValue={defaultValue}
        inputMode="decimal"
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-12 min-w-0 flex-1 bg-transparent px-2 text-base outline-none"
      />
    </div>
  );
}

export function FormationForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: FormationValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [count, setCount] = useState(initial?.installmentsCount ?? 0);
  const [installment, setInstallment] = useState(initial?.installment ?? "");
  const errors = state.fieldErrors ?? {};
  const totalCents = (parseArsToCents(installment) ?? 0) * count;

  return (
    <ActionForm action={formAction} className="space-y-6">
      <Field label="Nombre" error={errors.title}>
        <Input name="title" defaultValue={initial?.title} placeholder="Ej.: Profesorado de tango 2027" required />
      </Field>
      <Field label="Descripción" hint="Qué se aprende, para quién es, requisitos. La ven los aspirantes." error={errors.description}>
        <Textarea name="description" defaultValue={initial?.description} rows={5} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Empieza" error={errors.startsOn}>
          <Input name="startsOn" type="date" defaultValue={initial?.startsOn} required />
        </Field>
        <Field label="Termina" error={errors.endsOn}>
          <Input name="endsOn" type="date" defaultValue={initial?.endsOn} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cupo" hint="Vacío = sin límite" error={errors.capacity}>
          <Input name="capacity" type="number" inputMode="numeric" min={1} defaultValue={initial?.capacity} />
        </Field>
        <Field label="Asistencia mínima" hint="Para aprobar" error={errors.minAttendance}>
          <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface">
            <input
              name="minAttendance"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              defaultValue={initial?.minAttendance ?? 80}
              className="h-12 min-w-0 flex-1 bg-transparent px-4 text-base outline-none"
            />
            <span className="pr-4 text-muted">%</span>
          </div>
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
        <input
          type="checkbox"
          name="requiresApproval"
          defaultChecked={initial?.requiresApproval ?? true}
          className="mt-1 h-5 w-5 accent-[var(--brand)]"
        />
        <span>
          <span className="block font-medium">Requiere aprobación del estudio</span>
          <span className="block text-sm text-muted">
            Los aspirantes se postulan y vos decidís a quién aceptar (por ejemplo, después de una audición). Si lo
            destildás, se inscriben directo.
          </span>
        </span>
      </label>

      <fieldset className="space-y-4 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Aranceles</legend>
        <Field label="Matrícula" hint="La pagan al ser aceptados para asegurar el lugar. 0 si no tiene." error={errors.enrollmentFee}>
          <MoneyInput name="enrollmentFee" defaultValue={initial?.enrollmentFee ?? "0"} placeholder="30.000" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cuotas" error={errors.installmentsCount}>
            <Select name="installmentsCount" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              <option value={0}>Sin cuotas</option>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "cuota" : "cuotas"}
                </option>
              ))}
            </Select>
          </Field>
          {count > 0 ? (
            <Field label="Valor de cada cuota" error={errors.installment}>
              <MoneyInput name="installment" defaultValue={initial?.installment} placeholder="40.000" onChange={setInstallment} />
            </Field>
          ) : null}
        </div>
        {count > 0 ? (
          <>
            <Field label="Vence la primera cuota" hint="Las siguientes vencen el mismo día de cada mes." error={errors.firstDueOn}>
              <Input name="firstDueOn" type="date" defaultValue={initial?.firstDueOn} />
            </Field>
            <Field
              label="Pago total con descuento"
              hint={totalCents ? `Opcional. En cuotas suman ${formatArs(totalCents)}.` : "Opcional."}
              error={errors.fullPayment}
            >
              <MoneyInput name="fullPayment" defaultValue={initial?.fullPayment} placeholder="280.000" />
            </Field>
          </>
        ) : null}
        <p className="text-xs text-muted">
          Si una cuota sigue impaga el día 10 del mes en que vence, se le pausa el acceso a la formación hasta que pague.
          Las clases regulares las sigue reservando.
        </p>
      </fieldset>

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}
