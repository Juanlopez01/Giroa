import { cheapestPlanWith, type Feature } from "@/lib/gating";

/** Aviso amable cuando una función no está en el plan del estudio. */
export async function UpgradeNotice({ feature, what }: { feature: Feature; what: string }) {
  const plan = await cheapestPlanWith(feature);
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
      <p className="font-medium">{what} no está incluido en tu plan.</p>
      <p className="text-sm text-muted">
        {plan ? `Está disponible desde el plan ${plan}. ` : ""}Escribinos y lo activamos.
      </p>
    </div>
  );
}
