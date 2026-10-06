"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Las rutas son las del subdominio del estudio (el proxy agrega /s/[slug]).
type Item = { href: string; label: string; exact?: boolean; adminOnly?: boolean; secondary?: boolean };

const ITEMS: Item[] = [
  { href: "/panel", label: "Inicio", exact: true },
  { href: "/panel/agenda", label: "Agenda" },
  { href: "/panel/alumnos", label: "Alumnos" },
  { href: "/panel/pagos", label: "Pagos", adminOnly: true },
  { href: "/panel/clases", label: "Clases", secondary: true },
  { href: "/panel/packs", label: "Packs", secondary: true },
  { href: "/panel/eventos", label: "Eventos", secondary: true },
  { href: "/panel/ajustes", label: "Ajustes", secondary: true, adminOnly: true },
  { href: "/panel/plan", label: "Tu plan", secondary: true, adminOnly: true },
];

const SECONDARY_ITEMS = ITEMS.filter((i) => i.secondary);

export function PanelNav({ variant, isAdmin }: { variant: "top" | "bottom"; isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const visible = ITEMS.filter((i) => isAdmin || !i.adminOnly);

  if (variant === "bottom") {
    // En el celular las secciones secundarias van dentro de "Más".
    const main = visible.filter((i) => !i.secondary);
    const moreActive = pathname === "/panel/mas" || SECONDARY_ITEMS.some(isActive);
    return (
      <nav className="grid" style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }}>
        {main.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`py-3 text-center text-xs font-medium ${isActive(item) ? "text-brand" : "text-muted"}`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/panel/mas"
          className={`py-3 text-center text-xs font-medium ${moreActive ? "text-brand" : "text-muted"}`}
        >
          Más
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {visible.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
            isActive(item) ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
