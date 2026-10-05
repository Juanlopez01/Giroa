"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { centsToInput, formatArs } from "@/lib/money";

export type StudentOption = { id: string; name: string; detail: string | null };
export type PackOption = { id: string; name: string; priceCents: number; summary: string; isCouple: boolean };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  students: StudentOption[];
  packs: PackOption[];
  initialStudentId: string | null;
};

const METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
] as const;

export function PaymentForm({ action, students, packs, initialStudentId }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [studentId, setStudentId] = useState(initialStudentId ?? "");
  const [filter, setFilter] = useState("");
  const [packId, setPackId] = useState(packs.length === 1 ? (packs[0]?.id ?? "") : "");
  const [amount, setAmount] = useState(packs.length === 1 && packs[0] ? centsToInput(packs[0].priceCents) : "");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const errors = state.fieldErrors ?? {};

  const pack = packs.find((p) => p.id === packId);
  const student = students.find((s) => s.id === studentId);

  const filtered = useMemo(() => {
    const q = filter
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    if (!q) return students.slice(0, 50);
    return students
      .filter((s) =>
        `${s.name} ${s.detail ?? ""}`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 50);
  }, [filter, students]);

  return (
    <ActionForm action={formAction} className="space-y-6">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="method" value={method} />

      <Field label="Alumno" error={errors.studentId}>
        {student ? (
          <div className="flex h-12 items-center justify-between rounded-xl border border-border bg-surface px-4">
            <span className="truncate font-medium">{student.name}</span>
            <button type="button" onClick={() => setStudentId("")} className="shrink-0 text-sm text-brand">
              Cambiar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscá por nombre o email"
              autoComplete="off"
            />
            <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">No encontramos a nadie con ese nombre.</li>
              ) : (
                filtered.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setStudentId(s.id)}
                      className="block w-full px-4 py-3 text-left hover:bg-background"
                    >
                      <span className="block font-medium">{s.name}</span>
                      {s.detail ? <span className="block text-sm text-muted">{s.detail}</span> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </Field>

      <Field label="Pack" error={errors.packProductId}>
        <Select
          name="packProductId"
          value={packId}
          onChange={(e) => {
            setPackId(e.target.value);
            const p = packs.find((x) => x.id === e.target.value);
            if (p) setAmount(centsToInput(p.priceCents));
          }}
          required
        >
          <option value="" disabled>
            Elegí un pack
          </option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.summary} · {formatArs(p.priceCents)}
            </option>
          ))}
        </Select>
      </Field>

      {pack?.isCouple ? (
        <Field label="Pareja" hint="Comparten el saldo de este pack." error={errors.partnerStudentId}>
          <Select name="partnerStudentId" defaultValue="">
            <option value="">Sin pareja por ahora</option>
            {students
              .filter((s) => s.id !== studentId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">¿Cómo pagó?</legend>
        <div className="grid grid-cols-2 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              aria-pressed={method === m.value}
              className="h-12 rounded-xl border border-border bg-surface font-medium aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground"
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Monto cobrado"
        hint={pack && amount !== centsToInput(pack.priceCents) ? `El precio del pack es ${formatArs(pack.priceCents)}.` : "Si le hiciste un descuento, cambialo."}
        error={errors.amount}
      >
        <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
          <span className="pl-4 text-base text-muted">$</span>
          <input
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="h-12 min-w-0 flex-1 bg-transparent px-2 text-base outline-none"
          />
        </div>
      </Field>

      <Field label="Nota" hint="Opcional. Por ejemplo: número de transferencia." error={errors.notes}>
        <Input name="notes" autoComplete="off" />
      </Field>

      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending || !studentId || !packId}>
        {pending ? "Registrando…" : "Registrar pago y acreditar pack"}
      </Button>
    </ActionForm>
  );
}
