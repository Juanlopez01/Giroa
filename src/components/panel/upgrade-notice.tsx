import Link from "next/link";
import { cheapestPlanWith, type Feature } from "@/lib/gating";

/** Aviso amable cuando una función no está en el plan del estudio. */
export async function UpgradeNotice({ feature, what }: { feature: Feature; what: string }) {
  const plan = await cheapestPlanWith(feature);
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <p className="font-medium">{what} no está incluido en tu plan.</p>
      <p className="text-sm text-muted">
        {plan ? `Está disponible desde el plan ${plan}. ` : ""}Si estás en la prueba gratis, podés probarlo sin costo.
      </p>
      <Link href="/panel/plan" className="inline-flex h-11 items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-foreground">
        Ver planes
      </Link>
    </div>
  );
}
