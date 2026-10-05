"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Las rutas son las del subdominio del estudio (el proxy agrega /s/[slug]).
const ITEMS = [
  { href: "/panel", label: "Inicio", exact: true },
  { href: "/panel/agenda", label: "Agenda" },
  { href: "/panel/clases", label: "Clases" },
] as const;

export function PanelNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "bottom") {
    return (
      <nav className="grid grid-cols-3">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`py-3 text-center text-sm font-medium ${
              isActive(item.href, "exact" in item ? item.exact : false) ? "text-brand" : "text-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex gap-1">
      {ITEMS.map((item) => {
        const active = isActive(item.href, "exact" in item ? item.exact : false);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
              active ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
