import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { platformUrl } from "@/lib/urls";
import { signOut } from "@/app/(platform)/login/actions";

export const metadata: Metadata = { title: "Más" };

const LINKS: { href: string; label: string; detail: string; access?: "admin" | "owner" }[] = [
  { href: "/panel/clases", label: "Clases", detail: "Clases regulares y sus horarios", access: "admin" },
  { href: "/panel/packs", label: "Packs", detail: "Lo que compran tus alumnos para reservar", access: "admin" },
  { href: "/panel/eventos", label: "Eventos", detail: "Milongas, seminarios y muestras con entradas" },
  { href: "/panel/formaciones", label: "Formaciones", detail: "Profesorados y programas: postulaciones, cuotas y asistencia" },
  { href: "/panel/equipo", label: "Equipo", detail: "Profes y encargados, y qué puede hacer cada uno", access: "admin" },
  { href: "/panel/ajustes", label: "Ajustes", detail: "Mercado Pago, reservas y clase de prueba", access: "admin" },
  { href: "/panel/plan", label: "Tu plan", detail: "Suscripción a Giroa", access: "owner" },
];

// En el celular, las secciones que no entran en la barra de abajo.
export default async function MorePage({ params }: PageProps<"/s/[slug]/panel/mas">) {
  const { slug } = await params;
  const { user, isAdmin, isOwner } = await requireStaff(slug, "/panel/mas");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Más</h1>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {LINKS.filter((l) => (l.access === "owner" ? isOwner : l.access === "admin" ? isAdmin : true)).map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block px-4 py-4 hover:bg-background">
              <span className="block font-medium">{l.label}</span>
              <span className="block text-sm text-muted">{l.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="space-y-3 text-sm">
        <a href={platformUrl("/estudios")} className="block text-muted hover:text-foreground">
          Cambiar de estudio
        </a>
        <form action={signOut}>
          <button type="submit" className="text-muted hover:text-foreground">
            Salir ({user.email})
          </button>
        </form>
      </div>
    </div>
  );
}
