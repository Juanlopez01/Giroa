"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Con la suscripción vencida (pasada la gracia), el panel muestra solo "Tu
 * plan" al dueño y un mensaje al resto del staff. Es un bloqueo de interfaz:
 * los alumnos siguen reservando con lo que ya pagaron.
 */
export function AccessGate({
  blocked,
  isAdmin,
  children,
}: {
  blocked: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (!blocked || (isAdmin && pathname.startsWith("/panel/plan"))) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <h1 className="text-2xl font-semibold">El panel está pausado</h1>
      <p className="text-muted">
        {isAdmin
          ? "Para seguir usando Giroa, elegí tu plan y suscribite. Tus alumnos siguen viendo su saldo y reservando."
          : "La suscripción del estudio está pausada. Avisale al dueño para que la reactive."}
      </p>
      {isAdmin ? (
        <Link href="/panel/plan" className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-medium text-brand-foreground">
          Elegir mi plan
        </Link>
      ) : null}
    </div>
  );
}
