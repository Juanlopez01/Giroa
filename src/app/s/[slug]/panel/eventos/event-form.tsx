"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

export type EventFormValues = {
  title: string;
  description: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: EventFormValues;
  minDate: string;
  submitLabel: string;
};

export function EventForm({ action, initial, minDate, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      <Field label="Nombre del evento" error={errors.title}>
        <Input name="title" defaultValue={initial?.title} placeholder="Ej.: Milonga de primavera" required />
      </Field>

      <Field label="Fecha" error={errors.date}>
        <Input name="date" type="date" min={minDate} defaultValue={initial?.date} required aria-invalid={Boolean(errors.date)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Empieza" error={errors.startTime}>
          <Input name="startTime" type="time" defaultValue={initial?.startTime ?? "21:00"} required />
        </Field>
        <Field label="Termina" hint="Opcional" error={errors.endTime}>
          <Input name="endTime" type="time" defaultValue={initial?.endTime} />
        </Field>
      </div>

      <Field label="Lugar" hint="Opcional. Si no ponés nada, se entiende que es en el estudio." error={errors.venue}>
        <Input name="venue" defaultValue={initial?.venue} placeholder="Ej.: Salón Canning, Scalabrini Ortiz 1331" />
      </Field>

      <Field label="Descripción" hint="Opcional. Quién toca, quién enseña, qué incluye." error={errors.description}>
        <Textarea name="description" defaultValue={initial?.description} rows={4} />
      </Field>

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}
