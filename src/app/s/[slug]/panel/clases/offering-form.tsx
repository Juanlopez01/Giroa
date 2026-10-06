"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import type { DisciplineOption } from "@/lib/disciplines";

export type OfferingFormValues = {
  title: string;
  disciplineKey: string;
  level: string;
  teacherName: string;
  description: string;
  capacity: number;
  roleBalanceMaxDiff: number | null;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  disciplines: DisciplineOption[];
  initial?: OfferingFormValues;
  submitLabel: string;
  /** El plan incluye balance de roles. */
  allowRoleBalance: boolean;
};

export function OfferingForm({ action, disciplines, initial, submitLabel, allowRoleBalance }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [disciplineKey, setDisciplineKey] = useState(initial?.disciplineKey ?? "");
  const [roleBalance, setRoleBalance] = useState(initial ? initial.roleBalanceMaxDiff !== null : true);

  // La interfaz depende de los flags de la disciplina, no de su nombre.
  const features = disciplines.find((d) => d.key === disciplineKey)?.features;
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      <Field label="Nombre de la clase" error={errors.title}>
        <Input
          name="title"
          defaultValue={initial?.title}
          placeholder="Ej.: Tango principiantes"
          required
          aria-invalid={Boolean(errors.title)}
        />
      </Field>

      <Field label="Disciplina" error={errors.disciplineKey}>
        <Select
          name="disciplineKey"
          value={disciplineKey}
          onChange={(e) => setDisciplineKey(e.target.value)}
          required
          aria-invalid={Boolean(errors.disciplineKey)}
        >
          <option value="" disabled>
            Elegí una disciplina
          </option>
          {disciplines.map((d) => (
            <option key={d.key} value={d.key}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={features?.equipment_capacity ? "Equipos" : "Cupo"}
          hint={features?.equipment_capacity ? "El cupo es la cantidad de máquinas." : "Lugares por clase."}
          error={errors.capacity}
        >
          <Input
            name="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            defaultValue={initial?.capacity ?? 20}
            required
            aria-invalid={Boolean(errors.capacity)}
          />
        </Field>
        <Field label={features?.levels ? "Nivel o graduación" : "Nivel"} hint="Opcional." error={errors.level}>
          <Input
            name="level"
            defaultValue={initial?.level}
            placeholder={features?.levels ? "Ej.: Cinturón azul" : "Ej.: Principiantes"}
          />
        </Field>
      </div>

      {features?.role_balance && allowRoleBalance ? (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="roleBalance"
              checked={roleBalance}
              onChange={(e) => setRoleBalance(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--brand)]"
            />
            <span>
              <span className="block font-medium">Balancear líderes y seguidores</span>
              <span className="block text-sm text-muted">
                Cada alumno elige su rol al reservar y Giroa no deja que la clase se desbalancee.
              </span>
            </span>
          </label>
          {roleBalance ? (
            <Field
              label="Diferencia máxima entre roles"
              hint="Con 2, puede haber hasta 2 líderes más que seguidores (o al revés)."
              error={errors.roleBalanceMaxDiff}
            >
              <Input
                name="roleBalanceMaxDiff"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                defaultValue={initial?.roleBalanceMaxDiff ?? 2}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <Field label="Profe" hint="El nombre que ven los alumnos. Opcional." error={errors.teacherName}>
        <Input name="teacherName" defaultValue={initial?.teacherName} placeholder="Ej.: Lucía Pérez" />
      </Field>

      <Field label="Descripción" hint="Opcional. Qué se trabaja, qué traer, etc." error={errors.description}>
        <Textarea name="description" defaultValue={initial?.description} rows={3} />
      </Field>

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}
