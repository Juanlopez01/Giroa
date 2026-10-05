import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-foreground hover:opacity-90",
  secondary: "border border-border bg-surface text-foreground hover:bg-background",
  ghost: "text-muted hover:text-foreground",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
