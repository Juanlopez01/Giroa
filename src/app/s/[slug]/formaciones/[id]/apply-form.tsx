"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

export function ApplyForm({
  action,
  defaults,
  requiresApproval,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults: { fullName: string; phone: string };
  requiresApproval: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Nombre y apellido" error={errors.fullName}>
        <Input name="fullName" defaultValue={defaults.fullName} autoComplete="name" required />
      </Field>
      <Field label="Celular" hint="Opcional" error={errors.phone}>
        <Input name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} autoComplete="tel" />
      </Field>
      <Field
        label={requiresApproval ? "Contanos de vos" : "¿Algo que quieras contarnos?"}
        hint={requiresApproval ? "Experiencia, disciplinas, por qué te interesa. Lo lee el estudio." : "Opcional"}
        error={errors.message}
      >
        <Textarea name="message" rows={4} maxLength={2000} />
      </Field>
      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : requiresApproval ? "Postularme" : "Inscribirme"}
      </Button>
    </ActionForm>
  );
}
