"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-12 rounded-xl bg-brand px-6 font-medium text-brand-foreground"
    >
      Imprimir el cartel
    </button>
  );
}
