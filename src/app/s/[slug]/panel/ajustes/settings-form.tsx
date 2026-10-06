"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

export function SettingsForm({
  action,
  cancelWindowHours,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  cancelWindowHours: number;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field
        label="Ventana de cancelación (horas)"
        hint="Si un alumno cancela con al menos esta anticipación, se le devuelve la clase."
        error={state.fieldErrors?.cancelWindowHours}
      >
        <Input name="cancelWindowHours" type="number" inputMode="numeric" min={0} max={168} defaultValue={cancelWindowHours} />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </ActionForm>
  );
}
