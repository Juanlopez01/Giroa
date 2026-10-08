"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, CalendarDays, House, ScanLine, UserRound, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const LEFT: Item[] = [
  { href: "/app", label: "Inicio", icon: House, exact: true },
  { href: "/app/clases", label: "Clases", icon: CalendarDays },
];
const RIGHT: Item[] = [
  { href: "/app/reservas", label: "Reservas", icon: Bookmark },
  { href: "/app/perfil", label: "Perfil", icon: UserRound },
];

/**
 * Barra flotante de la app del alumno. En el centro, "Presente": abre el
 * escáner para el QR del estudio (lo más usado al llegar a clase).
 */
export function StudentNav() {
  const pathname = usePathname();
  const isActive = (item: Item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  const presentActive = pathname.startsWith("/app/presente");

  const tab = (item: Item) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition-colors ${
          active ? "text-brand" : "text-muted hover:text-foreground"
        }`}
      >
        <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brand/10" : ""}`}>
          <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
        </span>
        {item.label}
      </Link>
    );
  };

  return (
    <nav aria-label="Menú" className="flex items-end rounded-full border border-border bg-surface/95 px-2 py-1 shadow-lg shadow-black/5 backdrop-blur">
      {LEFT.map(tab)}
      <Link
        href="/app/presente"
        aria-current={presentActive ? "page" : undefined}
        className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 text-[11px] font-medium text-brand"
      >
        <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-black/15 ring-4 ring-background transition-transform active:scale-95">
          <ScanLine className="h-6 w-6" strokeWidth={2.2} aria-hidden />
        </span>
        Presente
      </Link>
      {RIGHT.map(tab)}
    </nav>
  );
}
