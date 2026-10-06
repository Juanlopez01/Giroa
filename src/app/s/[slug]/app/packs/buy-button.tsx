"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";

export function BuyButton({ buy }: { buy: () => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await buy()))}
        className="h-11 w-full rounded-xl bg-[#009ee3] text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Abriendo Mercado Pago…" : "Comprar con Mercado Pago"}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
