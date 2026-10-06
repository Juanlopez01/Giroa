import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { platformUrl } from "@/lib/urls";
import { signOut } from "@/app/(platform)/login/actions";

export const metadata: Metadata = { title: "Más" };

const LINKS = [
  { href: "/panel/clases", label: "Clases", detail: "Clases regulares y sus horarios" },
  { href: "/panel/packs", label: "Packs", detail: "Lo que compran tus alumnos para reservar" },
  { href: "/panel/ajustes", label: "Ajustes", detail: "Mercado Pago y reglas de reserva", adminOnly: true },
];

// En el celular, las secciones que no entran en la barra de abajo.
export default async function MorePage({ params }: PageProps<"/s/[slug]/panel/mas">) {
  const { slug } = await params;
  const { user, isAdmin } = await requireStaff(slug, "/panel/mas");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Más</h1>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {LINKS.filter((l) => isAdmin || !("adminOnly" in l)).map((l) => (
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
