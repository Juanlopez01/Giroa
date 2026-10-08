"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
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

const PRIMARY = "h-11 w-full rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground transition-transform active:scale-[0.98] disabled:opacity-60";
const SECONDARY = "h-11 w-full rounded-full border border-border bg-surface px-4 text-sm font-medium disabled:opacity-60";

export function BookButton({ book, roleBalance, leaders, followers, maxDiff, defaultRole, full, waitlist, label = "Reservar" }: BookProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(waitlist?.position ?? null);

  if (result?.ok && result.code === "booked") {
    return <p className="rounded-full bg-success/10 py-2.5 text-center text-sm font-medium text-success">¡Listo! Tenés tu lugar ✓</p>;
  }

  const run = (role: Role | null) =>
    startTransition(async () => {
      const r = await book(role);
      if (r.ok) navigator.vibrate?.(60);
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
    <p className={`text-xs ${result.ok ? "text-muted" : "text-danger"}`}>{result.message}</p>
  ) : null;

  // Ya está en la lista de espera (y la clase sigue sin lugar).
  if (waiting !== null && full) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-full bg-border/40 py-1.5 pr-1.5 pl-4">
        <p className="text-sm font-medium">{waiting > 0 ? `En espera · sos el ${waiting}°` : "Te avisamos si se libera"}</p>
        <button type="button" disabled={pending} onClick={leave} className="h-8 rounded-full px-3 text-xs text-muted hover:text-danger disabled:opacity-50">
          {pending ? "…" : "Salir"}
        </button>
        {message}
      </div>
    );
  }

  if (full) {
    if (!waitlist) return null;
    return (
      <div className="space-y-1">
        <button type="button" disabled={pending} onClick={() => join(roleBalance ? defaultRole : null)} className={`${SECONDARY} inline-flex items-center justify-center gap-2`}>
          <Bell className="h-4 w-4" aria-hidden /> {pending ? "…" : "Avisame si se libera"}
        </button>
        {message}
      </div>
    );
  }

  if (!roleBalance || !choosing) {
    return (
      <div className="space-y-1">
        <button type="button" disabled={pending} onClick={() => (roleBalance ? setChoosing(true) : run(null))} className={PRIMARY}>
          {pending ? "Reservando…" : label}
        </button>
        {waiting !== null ? <p className="text-xs text-muted">{roleBalance ? "Estás en lista de espera" : "¡Se liberó un lugar!"}</p> : null}
        {message}
      </div>
    );
  }

  // Danza en pareja: elegís el rol. Si un rol no entra por balance, se puede esperar como ese rol.
  const counts = { leaders, followers, maxDiff };
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">¿Cómo venís?</p>
      <div className="grid grid-cols-2 gap-2">
        {(["leader", "follower"] as const).map((role) => {
          const ok = canJoinAs(role, counts);
          if (!ok && waitlist) {
            return (
              <button
                key={role}
                type="button"
                disabled={pending || waiting !== null}
                onClick={() => join(role)}
                className="h-11 rounded-full border border-dashed border-border text-xs font-medium text-muted disabled:opacity-60"
              >
                {pending ? "…" : waiting !== null ? `${ROLE_LABELS[role]}: en espera` : `${ROLE_LABELS[role]}: esperar`}
              </button>
            );
          }
          return (
            <button
              key={role}
              type="button"
              disabled={pending || !ok}
              onClick={() => run(role)}
              className={`h-11 rounded-full text-sm font-medium disabled:opacity-40 ${
                role === defaultRole ? "bg-brand text-brand-foreground" : "border border-border bg-surface"
              }`}
            >
              {pending ? "…" : ok ? ROLE_LABELS[role] : `${ROLE_LABELS[role]} (lleno)`}
            </button>
          );
        })}
      </div>
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
        className="h-9 rounded-full border border-border px-4 text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-50"
      >
        {pending ? "Cancelando…" : "Cancelar"}
      </button>
      {result && !result.ok ? <p className="text-xs text-danger">{result.message}</p> : null}
    </div>
  );
}
