"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";

export function CancelSubscriptionButton({ cancel }: { cancel: () => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  if (result?.ok) return <p className="text-sm text-muted">{result.message}</p>;
  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("¿Cancelar tu suscripción? Vas a poder usar Giroa hasta el fin del período pagado.")) {
            startTransition(async () => setResult(await cancel()));
          }
        }}
        className="text-sm text-muted hover:text-danger disabled:opacity-50"
      >
        {pending ? "Cancelando…" : "Cancelar suscripción"}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
