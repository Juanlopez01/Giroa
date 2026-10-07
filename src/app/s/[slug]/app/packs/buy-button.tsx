"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";
import type { CouponPreview } from "@/app/s/[slug]/coupon-actions";
import { CouponField, type AppliedCoupon } from "@/components/studio/coupon-field";
import { formatArs } from "@/lib/money";

export function BuyButton({
  buy,
  preview,
}: {
  buy: (coupon: string | null) => Promise<ActionState>;
  /** Solo si el estudio tiene cupones. */
  preview?: (code: string) => Promise<CouponPreview>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  return (
    <div className="space-y-2">
      {preview ? <CouponField preview={preview} applied={coupon} onChange={setCoupon} /> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await buy(coupon?.code ?? null)))}
        className="h-11 w-full rounded-xl bg-[#009ee3] text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending
          ? "Abriendo Mercado Pago…"
          : coupon
            ? `Pagar ${formatArs(coupon.finalCents)} con Mercado Pago`
            : "Comprar con Mercado Pago"}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
