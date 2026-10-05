"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { WEEKDAYS } from "@/lib/datetime";

// Lunes primero, como se piensa la semana en un estudio.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AddScheduleForm({
  action,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <p className="font-medium">Agregar horario</p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Día" error={errors.weekday}>
          <Select name="weekday" defaultValue="1">
            {WEEK_ORDER.map((d) => (
              <option key={d} value={d}>
                {WEEKDAYS[d]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hora" error={errors.startTime}>
          <Input name="startTime" type="time" defaultValue="19:00" required />
        </Field>
        <Field label="Minutos" error={errors.durationMinutes}>
          <Input name="durationMinutes" type="number" inputMode="numeric" min={15} max={600} step={5} defaultValue={90} required />
        </Field>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Agregando…" : "Agregar horario"}
      </Button>
    </form>
  );
}

export function RemoveScheduleButton({
  label,
  remove,
}: {
  label: string;
  remove: () => Promise<ActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`¿Quitar el horario ${label}? Se borran las próximas clases sin alumnos anotados.`)) return;
          startTransition(async () => setResult(await remove()));
        }}
        className="text-sm text-danger hover:underline disabled:opacity-50"
      >
        {pending ? "Quitando…" : "Quitar"}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
