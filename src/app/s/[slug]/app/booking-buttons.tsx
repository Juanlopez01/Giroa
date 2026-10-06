"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";
import { ROLE_LABELS } from "@/lib/disciplines";
import { canJoinAs, type Role } from "@/lib/role-balance";

type BookProps = {
  book: (role: Role | null) => Promise<ActionState>;
  roleBalance: boolean;
  leaders: number;
  followers: number;
  maxDiff: number | null;
  defaultRole: Role | null;
  full: boolean;
};

export function BookButton({ book, roleBalance, leaders, followers, maxDiff, defaultRole, full }: BookProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const [choosing, setChoosing] = useState(false);

  if (result?.ok) return <span className="text-sm font-medium text-success">Reservada ✓</span>;
  if (full) return <span className="text-sm text-muted">Completa</span>;

  const run = (role: Role | null) => startTransition(async () => setResult(await book(role)));
  const error =
    result && !result.ok ? <p className="mt-1 max-w-48 text-right text-xs text-danger">{result.message}</p> : null;

  if (!roleBalance || !choosing) {
    return (
      <div className="text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => (roleBalance ? setChoosing(true) : run(null))}
          className="h-10 rounded-xl bg-brand px-4 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending ? "…" : "Reservar"}
        </button>
        {error}
      </div>
    );
  }

  // Danza en pareja: elegís el rol; el que no entra por balance queda deshabilitado.
  const counts = { leaders, followers, maxDiff };
  return (
    <div className="flex flex-col items-end gap-1.5">
      {(["leader", "follower"] as const).map((role) => {
        const ok = canJoinAs(role, counts);
        return (
          <button
            key={role}
            type="button"
            disabled={pending || !ok}
            onClick={() => run(role)}
            className={`h-9 w-32 rounded-xl text-sm font-medium disabled:opacity-40 ${
              role === defaultRole ? "bg-brand text-brand-foreground" : "border border-border bg-surface"
            }`}
          >
            {pending ? "…" : ok ? ROLE_LABELS[role] : `${ROLE_LABELS[role]} (lleno)`}
          </button>
        );
      })}
      {error}
    </div>
  );
}

export function CancelBookingButton({
  cancel,
  insideWindow,
  windowHours,
}: {
  cancel: () => Promise<ActionState>;
  insideWindow: boolean;
  windowHours: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  if (result?.ok) return <p className="max-w-40 text-right text-xs text-muted">{result.message}</p>;

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const msg = insideWindow
            ? `Faltan menos de ${windowHours} h para la clase: si cancelás ahora, la clase NO se devuelve. ¿Cancelar igual?`
            : "¿Cancelar la reserva? Te devolvemos la clase.";
          if (confirm(msg)) startTransition(async () => setResult(await cancel()));
        }}
        className="text-sm text-danger hover:underline disabled:opacity-50"
      >
        {pending ? "Cancelando…" : "Cancelar"}
      </button>
      {result && !result.ok ? <p className="text-xs text-danger">{result.message}</p> : null}
    </div>
  );
}
