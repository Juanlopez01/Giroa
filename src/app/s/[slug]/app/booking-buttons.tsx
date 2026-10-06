"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";
import { ROLE_LABELS } from "@/lib/disciplines";
import { canJoinAs, type Role } from "@/lib/role-balance";

export type WaitlistProps = {
  /** Lugar en la lista (1 = primero) o null si no está anotado. */
  position: number | null;
  join: (role: Role | null) => Promise<ActionState>;
  leave: () => Promise<ActionState>;
};

type BookProps = {
  book: (role: Role | null) => Promise<ActionState>;
  roleBalance: boolean;
  leaders: number;
  followers: number;
  maxDiff: number | null;
  defaultRole: Role | null;
  full: boolean;
  /** Solo si el plan del estudio tiene lista de espera. */
  waitlist?: WaitlistProps;
  /** Texto del botón (p. ej. "Reservar gratis" para la clase de prueba). */
  label?: string;
};

export function BookButton({ book, roleBalance, leaders, followers, maxDiff, defaultRole, full, waitlist, label = "Reservar" }: BookProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(waitlist?.position ?? null);

  if (result?.ok && result.code === "booked") return <span className="text-sm font-medium text-success">Reservada ✓</span>;

  const run = (role: Role | null) =>
    startTransition(async () => {
      const r = await book(role);
      setResult(r.ok ? { ...r, code: "booked" } : r);
    });
  const join = (role: Role | null) =>
    startTransition(async () => {
      if (!waitlist) return;
      const r = await waitlist.join(role);
      setResult(r);
      if (r.ok) setWaiting((n) => n ?? 0);
    });
  const leave = () =>
    startTransition(async () => {
      if (!waitlist) return;
      const r = await waitlist.leave();
      setResult(r);
      if (r.ok) setWaiting(null);
    });

  const message = result?.message ? (
    <p className={`mt-1 max-w-48 text-right text-xs ${result.ok ? "text-muted" : "text-danger"}`}>{result.message}</p>
  ) : null;

  // Ya está en la lista de espera (y la clase sigue sin lugar).
  if (waiting !== null && full) {
    return (
      <div className="text-right">
        <p className="text-sm font-medium">{waiting > 0 ? `En espera · sos el ${waiting}°` : "En lista de espera"}</p>
        <button type="button" disabled={pending} onClick={leave} className="text-xs text-muted hover:text-danger disabled:opacity-50">
          {pending ? "…" : "Salir de la lista"}
        </button>
        {message}
      </div>
    );
  }

  if (full) {
    if (!waitlist) return <span className="text-sm text-muted">Completa</span>;
    return (
      <div className="text-right">
        <p className="text-xs text-muted">Completa</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => join(roleBalance ? defaultRole : null)}
          className="h-10 rounded-xl border border-brand px-3 text-sm font-medium text-brand disabled:opacity-60"
        >
          {pending ? "…" : "Lista de espera"}
        </button>
        {message}
      </div>
    );
  }

  if (!roleBalance || !choosing) {
    return (
      <div className="text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => (roleBalance ? setChoosing(true) : run(null))}
          className="h-10 rounded-xl bg-brand px-4 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending ? "…" : label}
        </button>
        {waiting !== null ? (
          <p className="mt-1 text-xs text-muted">{roleBalance ? "Estás en lista de espera" : "¡Se liberó un lugar!"}</p>
        ) : null}
        {message}
      </div>
    );
  }

  // Danza en pareja: elegís el rol. Si un rol no entra por balance, se puede esperar como ese rol.
  const counts = { leaders, followers, maxDiff };
  return (
    <div className="flex flex-col items-end gap-1.5">
      {(["leader", "follower"] as const).map((role) => {
        const ok = canJoinAs(role, counts);
        if (!ok && waitlist) {
          return (
            <button
              key={role}
              type="button"
              disabled={pending || waiting !== null}
              onClick={() => join(role)}
              className="h-9 w-40 rounded-xl border border-dashed border-border text-sm font-medium text-muted disabled:opacity-60"
            >
              {pending ? "…" : waiting !== null ? `${ROLE_LABELS[role]}: en espera` : `${ROLE_LABELS[role]}: esperar lugar`}
            </button>
          );
        }
        return (
          <button
            key={role}
            type="button"
            disabled={pending || !ok}
            onClick={() => run(role)}
            className={`h-9 w-40 rounded-xl text-sm font-medium disabled:opacity-40 ${
              role === defaultRole ? "bg-brand text-brand-foreground" : "border border-border bg-surface"
            }`}
          >
            {pending ? "…" : ok ? ROLE_LABELS[role] : `${ROLE_LABELS[role]} (lleno)`}
          </button>
        );
      })}
      {message}
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
