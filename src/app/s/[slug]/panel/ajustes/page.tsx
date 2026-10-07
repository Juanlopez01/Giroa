import type { Metadata } from "next";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { createClient } from "@/lib/supabase/server";
import { platformUrl } from "@/lib/urls";
import { FormMessage } from "@/components/ui/field";
import { disconnectMercadoPago, setTrialClass, updateSettings } from "./actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

const MP_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "¡Listo! Vinculaste tu cuenta de Mercado Pago. Tus alumnos ya pueden comprar online." },
  error: { ok: false, text: "No pudimos vincular Mercado Pago. Probá de nuevo en un rato." },
  cancelado: { ok: false, text: "Cancelaste la vinculación con Mercado Pago." },
};

export default async function SettingsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/ajustes">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/ajustes");
  const mpParam = (await searchParams).mp;
  const mpMessage = typeof mpParam === "string" ? MP_MESSAGES[mpParam] : undefined;

  const supabase = await createClient();
  const { data: mp } = await supabase.rpc("mp_connection_status", { p_studio_id: studio.id });
  const connection = mp?.[0];
  const [mpAllowed, trialAllowed] = await Promise.all([can(studio.id, "mp_checkout"), can(studio.id, "trial_class")]);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold">Ajustes</h1>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Mercado Pago</h2>
        {mpMessage ? <FormMessage ok={mpMessage.ok} message={mpMessage.text} /> : null}
        {!mpAllowed ? (
          <UpgradeNotice feature="mp_checkout" what="El cobro online" />
        ) : connection?.connected ? (
          <>
            <p>
              <span className="font-medium text-success">Vinculado</span>
              {connection.live_mode === false ? " (modo prueba)" : ""}. La plata de cada venta va directo a tu cuenta.
            </p>
            <form action={disconnectMercadoPago.bind(null, slug)}>
              <button type="submit" className="text-sm text-muted hover:text-danger">
                Desvincular
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-muted">
              Vinculá tu cuenta para que tus alumnos compren packs desde el celular. La plata va directo a tu cuenta de
              Mercado Pago, no pasa por Giroa.
            </p>
            <a
              href={platformUrl(`/api/mp/oauth/start?studio=${studio.id}`)}
              className="inline-flex h-12 items-center rounded-xl bg-[#009ee3] px-5 font-medium text-white"
            >
              Vincular Mercado Pago
            </a>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reservas</h2>
        <SettingsForm action={updateSettings.bind(null, slug)} cancelWindowHours={studio.cancel_window_hours} />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Clase de prueba gratis</h2>
        {!trialAllowed ? (
          <UpgradeNotice feature="trial_class" what="La clase de prueba" />
        ) : (
          <>
            <p className="text-muted">
              Quien nunca compró un pack puede reservar una clase gratis para conocerte. Es una sola por persona; si
              cancela a tiempo, la puede volver a usar. Después le aparece en tu Inicio para que le escribas.
            </p>
            <form action={setTrialClass.bind(null, slug, !studio.trial_class_enabled)} className="flex items-center justify-between gap-4">
              <span className={`font-medium ${studio.trial_class_enabled ? "text-success" : "text-muted"}`}>
                {studio.trial_class_enabled ? "Activada" : "Desactivada"}
              </span>
              <button
                type="submit"
                className={`h-11 rounded-xl px-4 text-sm font-medium ${
                  studio.trial_class_enabled ? "border border-border bg-surface" : "bg-brand text-brand-foreground"
                }`}
              >
                {studio.trial_class_enabled ? "Desactivar" : "Activar clase de prueba"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
