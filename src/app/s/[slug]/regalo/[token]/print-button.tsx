"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-surface font-medium"
    >
      Imprimir o guardar en PDF
    </button>
  );
}
