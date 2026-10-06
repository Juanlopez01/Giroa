"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { initialActionState } from "@/lib/errors";
import { submitFounderLead } from "./actions";

export function FounderForm() {
  const [state, action, pending] = useActionState(submitFounderLead, initialActionState);
  const [kind, setKind] = useState<"studio" | "teacher">("studio");
  const errors = state.fieldErrors ?? {};

  if (state.ok) return <FormMessage ok message={state.message} />;

  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["studio", "Tengo un estudio"],
            ["teacher", "Soy profe"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            aria-pressed={kind === value}
            className="h-12 rounded-xl border border-border bg-surface text-sm font-medium aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground"
          >
            {label}
          </button>
        ))}
      </div>
      <Field label="Tu nombre" error={errors.name}>
        <Input name="name" autoComplete="name" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" error={errors.email}>
          <Input name="email" type="email" inputMode="email" autoComplete="email" required />
        </Field>
        <Field label="WhatsApp" hint="Opcional." error={errors.phone}>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" />
        </Field>
      </div>
      {kind === "studio" ? (
        <Field label="Nombre del estudio" error={errors.studioName}>
          <Input name="studioName" autoComplete="organization" />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="¿Qué disciplinas das?" hint="Ej.: tango, salsa, yoga." error={errors.disciplines}>
          <Input name="disciplines" />
        </Field>
        <Field label="¿Cuántos alumnos tenés?" hint="Aproximado." error={errors.studentsCount}>
          <Input name="studentsCount" inputMode="numeric" />
        </Field>
      </div>
      <Field label="¿Algo más que quieras contarnos?" hint="Opcional." error={errors.message}>
        <Textarea name="message" rows={3} />
      </Field>
      {/* Campo trampa para bots: oculto para las personas. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Quiero ser estudio fundador"}
      </Button>
    </ActionForm>
  );
}
