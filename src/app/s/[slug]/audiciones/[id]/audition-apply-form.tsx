"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { formatArs } from "@/lib/money";

export type AuditionQuestion = {
  id: string;
  label: string;
  kind: "short_text" | "long_text" | "choice" | "yes_no";
  options: string[];
  required: boolean;
};
export type SlotOption = { id: string; label: string; day: string; remaining: number };

export function AuditionApplyForm({
  action,
  questions,
  videoMode,
  slots,
  feeCents,
  defaults,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  questions: AuditionQuestion[];
  videoMode: "none" | "optional" | "required";
  slots: SlotOption[] | null;
  feeCents: number;
  defaults: { fullName: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [slot, setSlot] = useState("");
  const errors = state.fieldErrors ?? {};
  const days = slots ? [...new Set(slots.map((s) => s.day))] : [];

  return (
    <ActionForm action={formAction} className="space-y-5">
      <Field label="Nombre y apellido" error={errors.fullName}>
        <Input name="fullName" defaultValue={defaults.fullName} autoComplete="name" required />
      </Field>
      <Field label="Celular" hint="Opcional" error={errors.phone}>
        <Input name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} autoComplete="tel" />
      </Field>

      {questions.map((q) => {
        const label = q.required ? `${q.label} *` : q.label;
        if (q.kind === "long_text") {
          return (
            <Field key={q.id} label={label}>
              <Textarea name={`q_${q.id}`} rows={4} maxLength={3000} required={q.required} />
            </Field>
          );
        }
        if (q.kind === "choice" || q.kind === "yes_no") {
          const opts = q.kind === "yes_no" ? ["Sí", "No"] : q.options;
          return (
            <Field key={q.id} label={label}>
              <Select name={`q_${q.id}`} required={q.required} defaultValue="">
                <option value="" disabled>
                  Elegí una opción
                </option>
                {opts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
          );
        }
        return (
          <Field key={q.id} label={label}>
            <Input name={`q_${q.id}`} maxLength={300} required={q.required} />
          </Field>
        );
      })}

      {videoMode !== "none" ? (
        <Field
          label={videoMode === "required" ? "Link a tu video *" : "Link a tu video"}
          hint="YouTube, Google Drive o Instagram. Que se pueda ver con el link."
          error={errors.videoUrl}
        >
          <Input name="videoUrl" type="url" inputMode="url" placeholder="https://" required={videoMode === "required"} />
        </Field>
      ) : null}

      {slots ? (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">Elegí tu turno *</legend>
          <input type="hidden" name="slotId" value={slot} />
          {!slots.some((s) => s.remaining > 0) ? (
            <p className="rounded-xl bg-border/50 px-4 py-3 text-sm">No quedan turnos libres. Consultá con el estudio.</p>
          ) : (
            days.map((d) => (
              <div key={d} className="space-y-2">
                <p className="text-sm text-muted">{d}</p>
                <div className="flex flex-wrap gap-2">
                  {slots
                    .filter((s) => s.day === d)
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.remaining === 0}
                        aria-pressed={slot === s.id}
                        onClick={() => setSlot(s.id)}
                        className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium tabular-nums disabled:opacity-40 disabled:line-through aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground"
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              </div>
            ))
          )}
        </fieldset>
      ) : null}

      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending || (slots !== null && !slot)}>
        {pending ? (feeCents ? "Abriendo Mercado Pago…" : "Enviando…") : feeCents ? `Inscribirme y pagar ${formatArs(feeCents)}` : "Inscribirme a la audición"}
      </Button>
      {feeCents && slots ? <p className="text-center text-xs text-muted">Te guardamos el turno 20 minutos mientras pagás.</p> : null}
    </ActionForm>
  );
}
