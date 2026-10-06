import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { StudioForm } from "./studio-form";

export const metadata: Metadata = { title: "Creá tu estudio" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");

  return (
    <div className="space-y-8 pt-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted">Paso 1 de 2</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Creá tu estudio</h1>
        <p className="text-muted">Tenés 14 días de prueba gratis. No hace falta tarjeta.</p>
      </div>
      <StudioForm rootDomain={publicEnv().NEXT_PUBLIC_ROOT_DOMAIN} />
    </div>
  );
}
