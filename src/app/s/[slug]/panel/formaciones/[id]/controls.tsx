"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SessionForm({ action, minDate }: { action: FormAction; minDate: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Nombre" error={errors.title}>
        <Input name="title" placeholder="Ej.: Módulo 1 · Técnica y postura" required />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Fecha" error={errors.date}>
          <Input name="date" type="date" min={minDate} required />
        </Field>
        <Field label="Desde" error={errors.startTime}>
          <Input name="startTime" type="time" defaultValue="10:00" required />
        </Field>
        <Field label="Hasta" error={errors.endTime}>
          <Input name="endTime" type="time" defaultValue="13:00" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profe" hint="Opcional. Puede ser invitado." error={errors.teacherName}>
          <Input name="teacherName" />
        </Field>
        <Field label="Lugar" hint="Opcional" error={errors.location}>
          <Input name="location" placeholder="Sala grande" />
        </Field>
      </div>
      <Field label="Link si es online" hint="Opcional: Zoom, Meet…" error={errors.onlineUrl}>
        <Input name="onlineUrl" type="url" inputMode="url" placeholder="https://" />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar encuentro"}
      </Button>
    </ActionForm>
  );
}

export function AssessmentForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Nombre" error={errors.title}>
        <Input name="title" placeholder="Ej.: Coreografía final" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cómo se evalúa" error={errors.kind}>
          <Select name="kind" defaultValue="pass_fail">
            <option value="pass_fail">Aprobado / desaprobado</option>
            <option value="grade">Nota del 1 al 10</option>
          </Select>
        </Field>
        <Field label="Fecha de entrega" hint="Opcional" error={errors.dueOn}>
          <Input name="dueOn" type="date" />
        </Field>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar evaluación"}
      </Button>
    </ActionForm>
  );
}
