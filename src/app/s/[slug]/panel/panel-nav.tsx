"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  House,
  Layers,
  LayoutGrid,
  Megaphone,
  Plus,
  QrCode,
  Settings,
  Sparkles,
  Ticket,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

// Las rutas son las del subdominio del estudio (el proxy agrega /s/[slug]).
type Access = { isAdmin: boolean; isOwner: boolean; canTakePayments: boolean };
type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean; adminOnly?: boolean; ownerOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/panel", label: "Inicio", icon: House, exact: true },
  { href: "/panel/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/panel/alumnos", label: "Alumnos", icon: Users },
  { href: "/panel/pagos", label: "Pagos", icon: Wallet, adminOnly: true },
  { href: "/panel/clases", label: "Clases", icon: Layers, adminOnly: true },
  { href: "/panel/packs", label: "Packs", icon: Ticket, adminOnly: true },
  { href: "/panel/eventos", label: "Eventos", icon: Sparkles },
  { href: "/panel/formaciones", label: "Formaciones", icon: GraduationCap },
  { href: "/panel/anuncios", label: "Anuncios", icon: Megaphone, adminOnly: true },
  { href: "/panel/equipo", label: "Equipo", icon: UsersRound, adminOnly: true },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings, adminOnly: true },
  { href: "/panel/plan", label: "Tu plan", icon: CreditCard, ownerOnly: true },
];

/** En el celular, la barra tiene estas; el resto va en "Más". */
const BAR = ["/panel", "/panel/agenda", "/panel/alumnos"];

function useActive() {
  const pathname = usePathname();
  return (item: Pick<Item, "href" | "exact">) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function visibleItems({ isAdmin, isOwner }: Access) {
  return ITEMS.filter((i) => (isAdmin || !i.adminOnly) && (isOwner || !i.ownerOnly));
}

/** Compu: barra lateral con íconos. */
export function PanelSidebar(access: Access) {
  const isActive = useActive();
  return (
    <nav aria-label="Panel" className="space-y-0.5">
      {visibleItems(access).map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-brand/10 text-brand" : "text-muted hover:bg-border/40 hover:text-foreground"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Celular: barra flotante con el ＋ de acciones rápidas en el centro. */
export function PanelTabBar(access: Access) {
  const isActive = useActive();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const bar = visibleItems(access).filter((i) => BAR.includes(i.href));
  const moreActive = pathname === "/panel/mas" || visibleItems(access).some((i) => !BAR.includes(i.href) && isActive(i));

  const tab = (item: { href: string; label: string; icon: LucideIcon }, active: boolean) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium ${active ? "text-brand" : "text-muted"}`}
      >
        <span className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? "bg-brand/10" : ""}`}>
          <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
        </span>
        {item.label}
      </Link>
    );
  };

  const actions = [
    access.canTakePayments && { href: "/panel/pagos/nuevo", label: "Registrar un pago", icon: Wallet },
    { href: "/panel/alumnos/nuevo", label: "Nuevo alumno", icon: UserPlus },
    access.isAdmin && { href: "/panel/clases/nueva", label: "Nueva clase", icon: Layers },
    access.isAdmin && { href: "/panel/eventos/nuevo", label: "Nuevo evento", icon: Sparkles },
    access.isAdmin && { href: "/panel/anuncios", label: "Anuncio", icon: Megaphone },
    { href: "/panel/ajustes/qr", label: "Cartel QR", icon: QrCode },
    access.isAdmin && { href: "/panel/alumnos/importar", label: "Importar Excel", icon: FileSpreadsheet },
  ].filter(Boolean) as { href: string; label: string; icon: LucideIcon }[];

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Acciones rápidas"
            className="w-full rounded-t-3xl bg-surface px-5 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-xs font-medium tracking-widest text-muted uppercase">Acciones rápidas</p>
            <div className="grid grid-cols-2 gap-2">
              {actions.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 text-sm font-medium"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <nav aria-label="Panel" className="relative z-40 flex items-end rounded-full border border-border bg-surface/95 px-2 py-1 shadow-lg shadow-black/5 backdrop-blur">
        {bar.slice(0, 2).map((i) => tab(i, isActive(i)))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Cerrar acciones rápidas" : "Acciones rápidas"}
          className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 text-[11px] font-medium text-brand"
        >
          <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-black/15 ring-4 ring-background transition-transform active:scale-95">
            {open ? <X className="h-6 w-6" aria-hidden /> : <Plus className="h-7 w-7" strokeWidth={2.2} aria-hidden />}
          </span>
          {open ? "Cerrar" : "Nuevo"}
        </button>
        {bar.slice(2).map((i) => tab(i, isActive(i)))}
        {tab({ href: "/panel/mas", label: "Más", icon: LayoutGrid }, moreActive)}
      </nav>
    </>
  );
}
