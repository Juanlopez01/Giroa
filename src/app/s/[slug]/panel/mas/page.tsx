import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Layers,
  LogOut,
  QrCode,
  Settings,
  Sparkles,
  Ticket,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requireStaff } from "@/lib/panel";
import { platformUrl } from "@/lib/urls";
import { signOut } from "@/app/(platform)/login/actions";

export const metadata: Metadata = { title: "Más" };

const LINKS: { href: string; label: string; detail: string; icon: LucideIcon; access?: "admin" | "owner" }[] = [
  { href: "/panel/pagos", label: "Pagos", detail: "Lo cobrado en el mes, por medio de pago", icon: Wallet, access: "admin" },
  { href: "/panel/clases", label: "Clases", detail: "Clases regulares y sus horarios", icon: Layers, access: "admin" },
  { href: "/panel/packs", label: "Packs", detail: "Lo que compran tus alumnos, cupones y regalos", icon: Ticket, access: "admin" },
  { href: "/panel/eventos", label: "Eventos", detail: "Milongas, seminarios y muestras con entradas", icon: Sparkles },
  { href: "/panel/formaciones", label: "Formaciones", detail: "Profesorados, cuotas, asistencia y audiciones", icon: GraduationCap },
  { href: "/panel/ajustes/qr", label: "Cartel QR", detail: "Para que los alumnos se den el presente", icon: QrCode },
  { href: "/panel/equipo", label: "Equipo", detail: "Profes y encargados, y qué puede hacer cada uno", icon: UsersRound, access: "admin" },
  { href: "/panel/ajustes", label: "Ajustes", detail: "Tu marca, Mercado Pago, reservas y clase de prueba", icon: Settings, access: "admin" },
  { href: "/panel/plan", label: "Tu plan", detail: "Suscripción a Giroa", icon: CreditCard, access: "owner" },
];

// En el celular, las secciones que no entran en la barra de abajo.
export default async function MorePage({ params }: PageProps<"/s/[slug]/panel/mas">) {
  const { slug } = await params;
  const { user, isAdmin, isOwner } = await requireStaff(slug, "/panel/mas");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-serif text-3xl font-semibold">Más</h1>
      <nav className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {LINKS.filter((l) => (l.access === "owner" ? isOwner : l.access === "admin" ? isAdmin : true)).map(
          ({ href, label, detail, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-background">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted">{detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
            </Link>
          ),
        )}
      </nav>
      <nav className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <a href={platformUrl("/estudios")} className="flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-background">
          <ArrowLeftRight className="h-[18px] w-[18px] text-muted" aria-hidden /> Cambiar de estudio
        </a>
        <form action={signOut}>
          <button type="submit" className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-danger hover:bg-danger/5">
            <LogOut className="h-[18px] w-[18px]" aria-hidden /> Cerrar sesión <span className="truncate text-muted">({user.email})</span>
          </button>
        </form>
      </nav>
    </div>
  );
}
