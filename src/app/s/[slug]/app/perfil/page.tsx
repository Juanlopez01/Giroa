import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History, LogOut, QrCode, Ticket, UserRound, type LucideIcon } from "lucide-react";
import { requireStudent } from "@/lib/student-app";
import { myBalances } from "@/lib/student-data.server";
import { ROLE_LABELS } from "@/lib/disciplines";
import { CreditsCard } from "@/components/student/home-cards";
import { signOutFromStudio } from "./actions";

export const metadata: Metadata = { title: "Perfil" };

const ITEMS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/app/perfil/datos", label: "Mis datos", hint: "Nombre, celular y rol", icon: UserRound },
  { href: "/app/packs", label: "Packs y pagos", hint: "Comprá o canjeá un regalo", icon: Ticket },
  { href: "/app/reservas?ver=pasadas", label: "Mi historial", hint: "Las clases a las que fuiste", icon: History },
  { href: "/app/qr", label: "Mi QR", hint: "Por si el profe te toma el presente", icon: QrCode },
];

export default async function StudentProfilePage({ params }: PageProps<"/s/[slug]/app/perfil">) {
  const { slug } = await params;
  const { studio, student, user } = await requireStudent(slug, "/app/perfil");
  const balances = await myBalances(studio.id, student.id);
  const initials = student.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand/10 font-serif text-2xl font-semibold text-brand">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold">{student.full_name}</h1>
          <p className="truncate text-sm text-muted">
            {user.email}
            {student.default_role ? ` · ${ROLE_LABELS[student.default_role]}` : ""}
          </p>
        </div>
      </div>

      <CreditsCard balances={balances} />

      <nav className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {ITEMS.map(({ href, label, hint, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-border/30">
            <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{label}</span>
              <span className="block text-sm text-muted">{hint}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
          </Link>
        ))}
        <form action={signOutFromStudio}>
          <button type="submit" className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-danger hover:bg-danger/5">
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </form>
      </nav>
    </div>
  );
}
