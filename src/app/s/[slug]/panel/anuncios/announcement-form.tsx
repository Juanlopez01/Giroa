"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";

type Option = { id: string; label: string };

export function AnnouncementForm({
  action,
  offerings,
  formations,
  minDate,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  offerings: Option[];
  formations: Option[];
  minDate: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [audience, setAudience] = useState<"all" | "offering" | "formation">("all");
  const [round, setRound] = useState(0);
  const lastOk = useRef<ActionState | null>(null);
  const errors: Record<string, string | undefined> = state.fieldErrors ?? {};

  // Después de publicar, el formulario queda limpio.
  useEffect(() => {
    if (state.ok && state !== lastOk.current) {
      lastOk.current = state;
      setAudience("all");
      setRound((r) => r + 1);
    }
  }, [state]);

  return (
    <ActionForm key={round} action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <Field label="Título" error={errors.title}>
        <Input name="title" maxLength={120} placeholder="Mañana no hay clase" required />
      </Field>
      <Field label="Mensaje" error={errors.body}>
        <Textarea name="body" rows={4} maxLength={2000} placeholder="Por el feriado, mañana el estudio está cerrado. Las reservas se pasan solas al jueves." required />
      </Field>
      <Field label="¿A quién?">
        <Select name="audience" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
          <option value="all">A todos los alumnos</option>
          {offerings.length ? <option value="offering">A los de una clase</option> : null}
          {formations.length ? <option value="formation">A los de una formación</option> : null}
        </Select>
      </Field>
      {audience === "offering" ? (
        <Field label="Clase" hint="Le llega a quien la reservó en los últimos 30 días o tiene reserva." error={errors.offeringId}>
          <Select name="offeringId" defaultValue="">
            <option value="" disabled>
              Elegí la clase
            </option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {audience === "formation" ? (
        <Field label="Formación" error={errors.formationId}>
          <Select name="formationId" defaultValue="">
            <option value="" disabled>
              Elegí la formación
            </option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Se ve en la app hasta" hint="Opcional. Si no ponés fecha, queda hasta que lo borres." error={errors.visibleUntil}>
        <Input name="visibleUntil" type="date" min={minDate} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="sendEmail" defaultChecked className="h-5 w-5 accent-[var(--brand)]" />
        Mandarlo también por mail
      </label>

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Publicando…" : "Publicar anuncio"}
      </Button>
    </ActionForm>
  );
}
