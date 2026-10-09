"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CheckInResult } from "./actions";

export function MarkPresentButton({ mark }: { mark: () => Promise<CheckInResult> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await mark();
            if (r.ok) router.refresh();
            else setError(r.message);
          })
        }
        className="h-9 rounded-full border border-border bg-surface px-4 text-sm font-medium hover:border-success hover:text-success disabled:opacity-50"
      >
        {pending ? "…" : "✓ Presente"}
      </button>
      {error ? <p className="max-w-48 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

/** Alumno que llegó sin reserva: buscarlo por nombre y marcarlo (consume saldo). */
export function WalkInPicker({
  students,
  mark,
  placeholder = "Llegó sin reserva: buscá por nombre",
  doneLabel = "presente",
}: {
  students: { id: string; name: string }[];
  mark: (studentId: string) => Promise<CheckInResult>;
  placeholder?: string;
  /** Lo que se muestra al terminar: "✓ Ana presente". */
  doneLabel?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const matches = useMemo(
    () => (q.trim().length < 2 ? [] : students.filter((s) => norm(s.name).includes(norm(q.trim()))).slice(0, 6)),
    [q, students],
  );

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full border border-border bg-surface px-5 text-base outline-none focus:border-brand"
      />
      {matches.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await mark(s.id);
                    setMsg(r.ok ? { ok: true, text: `✓ ${s.name} ${doneLabel}` } : { ok: false, text: r.message });
                    if (r.ok) {
                      setQ("");
                      router.refresh();
                    }
                  })
                }
                className="block w-full px-4 py-3 text-left hover:bg-background"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p> : null}
    </div>
  );
}
