import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";

export const metadata: Metadata = { title: "Pago" };

// Vuelta de Checkout Pro. El estado que manda MP en la URL es solo para el
// mensaje: el pack lo acredita el webhook después de consultar el pago.
const MESSAGES = {
  aprobado: {
    title: "¡Pago aprobado!",
    text: "En unos segundos se acredita tu pack. Si no lo ves, actualizá la pantalla.",
  },
  pendiente: {
    title: "Tu pago está pendiente",
    text: "Mercado Pago lo está procesando. Cuando se apruebe, el pack aparece solo.",
  },
  rechazado: {
    title: "El pago no se pudo hacer",
    text: "No se cobró nada. Probá de nuevo con otro medio de pago.",
  },
} as const;

export default async function PaymentReturnPage({ params, searchParams }: PageProps<"/s/[slug]/app/pago">) {
  const { slug } = await params;
  await requireStudent(slug, "/app/pago");
  const estado = (await searchParams).estado;
  const msg = MESSAGES[estado === "pendiente" || estado === "rechazado" ? estado : "aprobado"];

  return (
    <div className="space-y-6 pt-6 text-center">
      <h1 className="text-2xl font-semibold">{msg.title}</h1>
      <p className="text-muted">{msg.text}</p>
      <div className="flex flex-col gap-3">
        <Link href="/app" className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-5 font-medium text-brand-foreground">
          Ver mi saldo
        </Link>
        {estado === "rechazado" ? (
          <Link href="/app/packs" className="text-sm font-medium text-brand">
            Probar de nuevo
          </Link>
        ) : null}
      </div>
    </div>
  );
}
