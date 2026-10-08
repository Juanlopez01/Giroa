"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/ui/field";
import type { CheckinActionState } from "@/app/s/[slug]/app/presente/actions";
import { PresenceSuccess } from "./presence-success";

export type PresenceOption = { sessionId: string; title: string; when: string; kind: "class" | "formation"; booked: boolean };
type Role = "leader" | "follower";

/**
 * Cuando el presente no se resuelve solo: tiene varias clases ahora ("choose")
 * o no reservó ninguna ("walk_in": reserva y da el presente en un toque).
 */
export function PresenceChoices({
  mode,
  options,
  checkIn,
}: {
  mode: "choose" | "walk_in";
  options: PresenceOption[];
  checkIn: (sessionId: string, role: Role | null) => Promise<CheckinActionState>;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<CheckinActionState & { sessionId?: string }>({ ok: false });
  const [busy, setBusy] = useState<string | null>(null);

  const run = (sessionId: string, role: Role | null) => {
    setBusy(sessionId);
    start(async () => {
      const res = await checkIn(sessionId, role);
      if (res.ok) navigator.vibrate?.(120);
      setState({ ...res, sessionId });
    });
  };

  const done = state.ok && state.result && "session_id" in state.result ? state.result : null;
  if (done) {
    const opt = options.find((o) => o.sessionId === done.session_id);
    return (
      <PresenceSuccess
        title={opt?.title ?? done.title}
        when={opt?.when ?? ""}
        already={done.status === "already"}
        formation={done.kind === "formation"}
      />
    );
  }

  const needsRole = !state.ok && state.code === "role_required" ? state.sessionId : null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">{mode === "choose" ? "¿A cuál viniste?" : "Dar el presente"}</h1>
        <p className="text-muted">
          {mode === "choose"
            ? "Tenés más de una clase en este horario. Elegí en la que estás."
            : "No tenés reserva para esta hora. Si hay lugar, reservás y te damos el presente en un toque."}
        </p>
      </div>

      <ul className="space-y-3">
        {options.map((o) => (
          <li key={o.sessionId} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div>
              <p className="font-semibold">{o.title}</p>
              <p className="text-sm text-muted">{o.when}</p>
            </div>
            {needsRole === o.sessionId ? (
              <div className="grid grid-cols-2 gap-2">
                {(["leader", "follower"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={pending}
                    onClick={() => run(o.sessionId, r)}
                    className="h-11 rounded-full border border-border font-medium disabled:opacity-50"
                  >
                    {r === "leader" ? "Líder" : "Seguidor/a"}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(o.sessionId, null)}
                className="h-11 w-full rounded-full bg-brand font-medium text-brand-foreground disabled:opacity-50"
              >
                {pending && busy === o.sessionId ? "Dando el presente…" : o.booked ? "Dar el presente" : "Reservar y dar el presente"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <FormMessage ok={false} message={state.ok ? undefined : needsRole ? "Elegí si vas como líder o seguidor/a." : state.message} />
    </div>
  );
}
