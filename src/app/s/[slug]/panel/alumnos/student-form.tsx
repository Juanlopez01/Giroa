"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { ROLE_LABELS } from "@/lib/disciplines";

export type StudentFormValues = {
  fullName: string;
  email: string;
  phone: string;
  defaultRole: "leader" | "follower" | "";
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: StudentFormValues;
  /** Solo si el estudio da alguna disciplina con balance de roles. */
  askRole: boolean;
  submitLabel: string;
};

export function StudentForm({ action, initial, askRole, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      <Field label="Nombre y apellido" error={errors.fullName}>
        <Input name="fullName" defaultValue={initial?.fullName} autoComplete="off" required />
      </Field>
      <Field
        label="Email"
        hint="Opcional. Si lo cargás, cuando la persona entre a la app con ese email ve su saldo."
        error={errors.email}
      >
        <Input name="email" type="email" inputMode="email" defaultValue={initial?.email} autoComplete="off" />
      </Field>
      <Field label="Teléfono" hint="Opcional." error={errors.phone}>
        <Input name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone} autoComplete="off" />
      </Field>
      {askRole ? (
        <Field label="Rol habitual" hint="Para las danzas en pareja. Lo puede cambiar al reservar." error={errors.defaultRole}>
          <Select name="defaultRole" defaultValue={initial?.defaultRole ?? ""}>
            <option value="">Sin definir</option>
            <option value="leader">{ROLE_LABELS.leader}</option>
            <option value="follower">{ROLE_LABELS.follower}</option>
          </Select>
        </Field>
      ) : null}
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </ActionForm>
  );
}
