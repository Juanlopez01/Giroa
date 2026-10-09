"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

export function WorkshopForm({
  action,
  disciplines,
  minDate,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  disciplines: { key: string; name: string }[];
  minDate: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors: Record<string, string | undefined> = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <Field label="Nombre" error={errors.title}>
        <Input name="title" maxLength={120} placeholder="Workshop de giros con Carla" required />
      </Field>
      <Field label="Disciplina" error={errors.disciplineKey}>
        <Select name="disciplineKey" defaultValue="" required>
          <option value="" disabled>
            Elegí la disciplina
          </option>
          {disciplines.map((d) => (
            <option key={d.key} value={d.key}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Fecha" error={errors.date}>
          <Input name="date" type="date" min={minDate} required />
        </Field>
        <Field label="Desde" error={errors.start}>
          <Input name="start" type="time" required />
        </Field>
        <Field label="Hasta" error={errors.end}>
          <Input name="end" type="time" required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio" error={errors.price}>
          <Input name="price" inputMode="decimal" placeholder="15.000" required />
        </Field>
        <Field label="Cupo" error={errors.capacity}>
          <Input name="capacity" type="number" min={1} max={1000} defaultValue={20} required />
        </Field>
      </div>
      <Field label="Profe" hint="Opcional. El nombre que ven los alumnos." error={errors.teacherName}>
        <Input name="teacherName" maxLength={120} placeholder="Carla Ruiz" />
      </Field>
      <Field label="Descripción" hint="Opcional. Qué se trabaja, nivel, qué traer." error={errors.description}>
        <Textarea name="description" rows={3} maxLength={4000} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="packAllowed" className="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
        <span>
          También se puede reservar con una clase del pack
          <span className="block text-muted">Si no lo marcás, el workshop solo se reserva pagándolo.</span>
        </span>
      </label>

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear workshop"}
      </Button>
    </ActionForm>
  );
}
