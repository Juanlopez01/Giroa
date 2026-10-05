"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState } from "@/lib/errors";
import { sendMagicLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initialActionState);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormMessage ok message={state.message} />
        <p className="text-sm text-muted">¿No te llegó? Fijate en spam o pedí otro link en un minuto.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <Field label="Tu email" error={state.fieldErrors?.email}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="vos@ejemplo.com"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>
      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Mandando…" : "Mandame el link"}
      </Button>
    </form>
  );
}
