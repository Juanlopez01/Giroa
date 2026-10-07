"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type AuditionValues = {
  title: string;
  description: string;
  closesOn: string;
  fee: string;
  videoMode: "none" | "optional" | "required";
  usesSlots: boolean;
};

export function AuditionForm({ action, initial, submitLabel }: { action: FormAction; initial: AuditionValues; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Título de la convocatoria" error={errors.title}>
        <Input name="title" defaultValue={initial.title} required />
      </Field>
      <Field label="Texto de la convocatoria" hint="Qué se evalúa, qué tienen que preparar, cómo es el día." error={errors.description}>
        <Textarea name="description" defaultValue={initial.description} rows={5} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cierra la inscripción" hint="Opcional, inclusive" error={errors.closesOn}>
          <Input name="closesOn" type="date" defaultValue={initial.closesOn} />
        </Field>
        <Field label="Arancel" hint="0 si es gratis" error={errors.fee}>
          <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface focus-within:border-brand">
            <span className="pl-4 text-muted">$</span>
            <input name="fee" defaultValue={initial.fee} inputMode="decimal" className="h-12 min-w-0 flex-1 bg-transparent px-2 text-base outline-none" />
          </div>
        </Field>
      </div>
      <Field label="Video" error={errors.videoMode}>
        <Select name="videoMode" defaultValue={initial.videoMode}>
          <option value="none">No piden video</option>
          <option value="optional">Video opcional (link)</option>
          <option value="required">Video obligatorio (link)</option>
        </Select>
      </Field>
      <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
        <input type="checkbox" name="usesSlots" defaultChecked={initial.usesSlots} className="mt-1 h-5 w-5 accent-[var(--brand)]" />
        <span>
          <span className="block font-medium">Audición presencial con turnos</span>
          <span className="block text-sm text-muted">Cada aspirante elige un horario y recibe un recordatorio el día anterior.</span>
        </span>
      </label>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}

export function FieldForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [kind, setKind] = useState("short_text");
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Pregunta" error={errors.label}>
        <Input name="label" placeholder="Ej.: ¿Hace cuántos años bailás?" required />
      </Field>
      <Field label="Tipo de respuesta" error={errors.kind}>
        <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="short_text">Texto corto</option>
          <option value="long_text">Texto largo</option>
          <option value="choice">Una opción de una lista</option>
          <option value="yes_no">Sí / No</option>
        </Select>
      </Field>
      {kind === "choice" ? (
        <Field label="Opciones" hint="Separadas por coma. Ej.: Inicial, Intermedio, Avanzado" error={errors.options}>
          <Input name="options" required />
        </Field>
      ) : null}
      <label className="flex items-center gap-3">
        <input type="checkbox" name="required" defaultChecked className="h-5 w-5 accent-[var(--brand)]" />
        <span>Obligatoria</span>
      </label>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar pregunta"}
      </Button>
    </ActionForm>
  );
}

export function SlotsForm({ action, minDate }: { action: FormAction; minDate: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Día" error={errors.date}>
          <Input name="date" type="date" min={minDate} required />
        </Field>
        <Field label="Desde" error={errors.from}>
          <Input name="from" type="time" defaultValue="10:00" required />
        </Field>
        <Field label="Hasta" error={errors.to}>
          <Input name="to" type="time" defaultValue="13:00" required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cada (minutos)" error={errors.every}>
          <Input name="every" type="number" inputMode="numeric" min={5} defaultValue={20} required />
        </Field>
        <Field label="Personas por turno" error={errors.capacity}>
          <Input name="capacity" type="number" inputMode="numeric" min={1} defaultValue={1} required />
        </Field>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Generando…" : "Generar turnos"}
      </Button>
    </ActionForm>
  );
}
