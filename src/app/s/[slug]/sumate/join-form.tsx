"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { ROLE_LABELS } from "@/lib/disciplines";
import { marketingUrl } from "@/lib/urls";

export function JoinForm({
  action,
  askRole,
  email,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  askRole: boolean;
  email: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={formAction} className="space-y-5">
      {email ? <p className="text-sm text-muted">Entraste como {email}.</p> : null}
      <Field label="Nombre y apellido" error={errors.fullName}>
        <Input name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Celular" hint="Opcional. Por si el estudio necesita avisarte algo." error={errors.phone}>
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" />
      </Field>
      {askRole ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">¿Cómo bailás habitualmente?</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["leader", ROLE_LABELS.leader],
                ["follower", ROLE_LABELS.follower],
                ["", "Depende"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium has-checked:border-brand has-checked:bg-brand has-checked:text-brand-foreground"
              >
                <input type="radio" name="role" value={value} defaultChecked={value === ""} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          <p className="text-sm text-muted">Lo podés cambiar en cada reserva.</p>
        </fieldset>
      ) : null}
      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sumándote…" : "Sumarme"}
      </Button>
      <p className="text-center text-xs text-muted">
        Tus datos los usa el estudio para tus reservas y pagos.{" "}
        <a href={marketingUrl("/privacidad")} target="_blank" rel="noopener noreferrer" className="underline">
          Política de privacidad
        </a>
        .
      </p>
    </ActionForm>
  );
}
