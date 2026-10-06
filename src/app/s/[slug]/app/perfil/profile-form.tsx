"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { ROLE_LABELS } from "@/lib/disciplines";

export function ProfileForm({
  action,
  initial,
  askRole,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: { fullName: string; phone: string; role: "leader" | "follower" | "" };
  askRole: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      <Field label="Nombre y apellido" error={errors.fullName}>
        <Input name="fullName" defaultValue={initial.fullName} autoComplete="name" required />
      </Field>
      <Field label="Celular" error={errors.phone}>
        <Input name="phone" type="tel" inputMode="tel" defaultValue={initial.phone} autoComplete="tel" />
      </Field>
      {askRole ? (
        <Field label="Rol habitual" hint="Lo usamos para precargar tu reserva. Lo podés cambiar en cada clase.">
          <Select name="role" defaultValue={initial.role}>
            <option value="">Depende</option>
            <option value="leader">{ROLE_LABELS.leader}</option>
            <option value="follower">{ROLE_LABELS.follower}</option>
          </Select>
        </Field>
      ) : null}
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </ActionForm>
  );
}
