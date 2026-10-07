"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { formatArs } from "@/lib/money";

export function SellGiftForm({
  packs,
  action,
}: {
  packs: { id: string; name: string; priceCents: number }[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} className="space-y-4">
      <Field label="Pack" error={errors.packProductId}>
        <Select name="packProductId" defaultValue={packs[0]?.id} required>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatArs(p.priceCents)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quién lo compra" error={errors.buyerName}>
          <Input name="buyerName" required />
        </Field>
        <Field label="Para quién" hint="Opcional" error={errors.recipientName}>
          <Input name="recipientName" />
        </Field>
      </div>
      <Field label="Mensaje" hint="Opcional. Aparece en la tarjeta." error={errors.message}>
        <Input name="message" maxLength={500} />
      </Field>
      <Field label="Email de quien compra" hint="Opcional: le mandamos la tarjeta." error={errors.buyerEmail}>
        <Input name="buyerEmail" type="email" inputMode="email" />
      </Field>
      <fieldset className="flex gap-3">
        {(
          [
            ["cash", "Efectivo"],
            ["transfer", "Transferencia"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface p-3">
            <input type="radio" name="method" value={value} defaultChecked={value === "cash"} className="h-5 w-5 accent-[var(--brand)]" />
            {label}
          </label>
        ))}
      </fieldset>
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Registrando…" : "Vender gift card"}
      </Button>
    </ActionForm>
  );
}

export function RedeemForStudent({
  students,
  redeem,
}: {
  students: { id: string; name: string }[];
  redeem: (studentId: string) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  if (result?.ok) return <p className="text-xs text-success">{result.message}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand">
        Canjear por un alumno
      </button>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-2 text-sm"
          aria-label="Alumno"
        >
          <option value="">Elegí el alumno</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !studentId}
          onClick={() => startTransition(async () => setResult(await redeem(studentId)))}
          className="h-10 shrink-0 rounded-xl bg-brand px-3 text-sm font-medium text-brand-foreground disabled:opacity-50"
        >
          {pending ? "…" : "Canjear"}
        </button>
      </div>
      {result && !result.ok ? <p className="text-xs text-danger">{result.message}</p> : null}
    </div>
  );
}
