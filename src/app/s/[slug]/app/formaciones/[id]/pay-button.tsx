"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";

export function PayButton({ pay, label, variant = "primary" }: { pay: () => Promise<ActionState>; label: string; variant?: "primary" | "outline" }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await pay()))}
        className={`h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${
          variant === "primary" ? "bg-[#009ee3] text-white" : "border border-[#009ee3] text-[#0b6aa6]"
        }`}
      >
        {pending ? "Abriendo Mercado Pago…" : label}
      </button>
      {result && !result.ok ? <span className="max-w-60 text-right text-xs text-danger">{result.message}</span> : null}
    </span>
  );
}
