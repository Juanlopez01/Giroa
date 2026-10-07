"use client";

import { useState, useTransition } from "react";
import type { CouponPreview } from "@/app/s/[slug]/coupon-actions";
import { formatArs } from "@/lib/money";

export type AppliedCoupon = { code: string; discountCents: number; finalCents: number };

/**
 * "¿Tenés un código?": valida contra el servidor y avisa el código aplicado.
 * `preview` es una server action ya atada al estudio y al monto.
 */
export function CouponField({
  preview,
  applied,
  onChange,
}: {
  preview: (code: string) => Promise<CouponPreview>;
  applied: AppliedCoupon | null;
  onChange: (c: AppliedCoupon | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
        <span>
          Código <span className="font-semibold">{applied.code}</span>: −{formatArs(applied.discountCents)}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-medium underline">
          Quitar
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand">
        ¿Tenés un código de descuento?
      </button>
    );
  }

  const apply = () =>
    startTransition(async () => {
      const r = await preview(code);
      if (r.ok) {
        setError(null);
        onChange({ code: r.code, discountCents: r.discountCents, finalCents: r.finalCents });
      } else {
        setError(r.message);
      }
    });

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="Ej.: PRIMAVERA20"
          autoCapitalize="characters"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base uppercase outline-none focus:border-brand"
          aria-label="Código de descuento"
        />
        <button
          type="button"
          disabled={pending || code.trim().length < 3}
          onClick={apply}
          className="h-11 shrink-0 rounded-xl border border-brand px-4 text-sm font-medium text-brand disabled:opacity-50"
        >
          {pending ? "…" : "Aplicar"}
        </button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
