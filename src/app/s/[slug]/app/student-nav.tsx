"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Inicio", exact: true },
  { href: "/app/clases", label: "Reservar" },
  { href: "/app/qr", label: "Mi QR" },
  { href: "/app/perfil", label: "Perfil" },
];

export function StudentNav() {
  const pathname = usePathname();
  return (
    <nav className="grid grid-cols-4">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`py-3 text-center text-sm font-medium ${active ? "text-brand" : "text-muted"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
