"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { ROLE_INFO } from "@/lib/team";

export function InviteForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Email" error={errors.email}>
        <Input name="email" type="email" inputMode="email" autoComplete="off" placeholder="profe@gmail.com" required />
      </Field>
      <Field label="Nombre" hint="Opcional. Así lo ves en el panel." error={errors.name}>
        <Input name="name" placeholder="Ej.: Lucía Ferrari" />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Rol</legend>
        {(["teacher", "admin"] as const).map((r) => (
          <label key={r} className={`flex items-start gap-3 rounded-2xl border bg-surface p-4 ${role === r ? "border-brand" : "border-border"}`}>
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => setRole(r)}
              className="mt-1 h-5 w-5 accent-[var(--brand)]"
            />
            <span>
              <span className="block font-medium">{ROLE_INFO[r].label}</span>
              <span className="block text-sm text-muted">{ROLE_INFO[r].detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {role === "teacher" ? (
        <label className="flex items-center gap-3">
          <input type="checkbox" name="canTakePayments" className="h-5 w-5 accent-[var(--brand)]" />
          <span>Puede cobrar (registrar pagos en efectivo o transferencia)</span>
        </label>
      ) : null}
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Mandar invitación"}
      </Button>
    </ActionForm>
  );
}

/** Botón chico que corre una acción y muestra el resultado al lado. */
export function SmallAction({
  run,
  label,
  confirmText,
  danger,
}: {
  run: () => Promise<ActionState>;
  label: string;
  confirmText?: string;
  danger?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          startTransition(async () => setResult(await run()));
        }}
        className={`text-sm font-medium disabled:opacity-50 ${danger ? "text-muted hover:text-danger" : "text-brand"}`}
      >
        {pending ? "…" : label}
      </button>
      {result?.message ? <span className={`text-xs ${result.ok ? "text-muted" : "text-danger"}`}>{result.message}</span> : null}
    </span>
  );
}

export function MemberEditor({
  role,
  canTakePayments,
  save,
}: {
  role: "admin" | "teacher";
  canTakePayments: boolean;
  save: (role: "admin" | "teacher", canTakePayments: boolean) => Promise<ActionState>;
}) {
  const [r, setR] = useState(role);
  const [pay, setPay] = useState(canTakePayments);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const dirty = r !== role || pay !== canTakePayments;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          value={r}
          onChange={(e) => setR(e.target.value as "admin" | "teacher")}
          className="h-10 rounded-xl border border-border bg-surface px-3"
          aria-label="Rol"
        >
          <option value="teacher">Profe</option>
          <option value="admin">Encargado</option>
        </select>
        {r === "teacher" ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={pay} onChange={(e) => setPay(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
            Puede cobrar
          </label>
        ) : null}
        {dirty ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => setResult(await save(r, r === "teacher" && pay)))}
            className="h-10 rounded-xl bg-brand px-3 font-medium text-brand-foreground disabled:opacity-50"
          >
            {pending ? "…" : "Guardar"}
          </button>
        ) : null}
      </div>
      {result?.message ? <p className={`text-xs ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p> : null}
    </div>
  );
}
