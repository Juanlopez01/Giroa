"use client";

import { useState } from "react";

/** Texto para copiar (un link o un código) con su botón. */
export function CopyField({ value, label = "Copiar", multiline = false }: { value: string; label?: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el texto igual se puede seleccionar a mano.
    }
  };
  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea
          readOnly
          value={value}
          rows={4}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
        />
      ) : (
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs"
        />
      )}
      <button type="button" onClick={copy} className="h-10 rounded-full border border-border bg-surface px-4 text-sm font-medium">
        {copied ? "¡Copiado!" : label}
      </button>
    </div>
  );
}
