"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

/** Quién firma los certificados y el texto que llevan. */
export function CertificateSettingsForm({
  action,
  initial,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: { signerName: string; signerRole: string; text: string };
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quién firma" hint="Opcional" error={errors.signerName}>
          <Input name="signerName" defaultValue={initial.signerName} maxLength={120} placeholder="Lucía Ferrari" />
        </Field>
        <Field label="Cargo" hint="Opcional" error={errors.signerRole}>
          <Input name="signerRole" defaultValue={initial.signerRole} maxLength={80} placeholder="Directora" />
        </Field>
      </div>
      <Field label="Texto del certificado" hint="Opcional. Va debajo del nombre de la formación." error={errors.text}>
        <Input name="text" defaultValue={initial.text} maxLength={300} placeholder="con una carga horaria de 120 horas" />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </ActionForm>
  );
}
