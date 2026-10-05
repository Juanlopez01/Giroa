import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="block text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-sm text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-danger ${className}`}
      {...props}
    />
  );
}

export function FormMessage({ ok, message }: { ok: boolean; message?: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-xl px-4 py-3 text-sm ${ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
    >
      {message}
    </p>
  );
}
