"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { formatArs } from "@/lib/money";

export type PlanOption = { key: string; name: string; monthlyCents: number; limit: number | null; highlight: boolean; soon: boolean };

type Props = {
  plans: PlanOption[];
  currentPlan: string | null;
  inTrial: boolean;
  subscribe: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  chooseTrialPlan: (plan: string) => Promise<ActionState>;
};

export function PlanPicker({ plans, currentPlan, inTrial, subscribe, chooseTrialPlan }: Props) {
  const [state, formAction, pending] = useActionState(subscribe, initialActionState);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  // Un plan "Próximamente" no se puede elegir: si es el que está probando, arranca en Estudio.
  const [selected, setSelected] = useState(plans.find((p) => p.key === currentPlan && !p.soon)?.key ?? "estudio");
  const [trialMsg, setTrialMsg] = useState<ActionState | null>(null);
  const [trialPending, startTrial] = useTransition();

  const price = (p: PlanOption) => (cycle === "annual" ? p.monthlyCents * 10 : p.monthlyCents);

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-sm">
        {(
          [
            ["monthly", "Mensual"],
            ["annual", "Anual · 2 meses gratis"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCycle(value)}
            aria-pressed={cycle === value}
            className="rounded-lg px-3 py-2 font-medium text-muted aria-pressed:bg-brand aria-pressed:text-brand-foreground"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => !p.soon && setSelected(p.key)}
            disabled={p.soon}
            aria-pressed={selected === p.key}
            className="rounded-2xl border border-border bg-surface p-4 text-left disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-brand aria-pressed:ring-2 aria-pressed:ring-brand/20"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">
                {p.name}
                {p.key === currentPlan ? <span className="ml-2 text-xs font-normal text-muted">{inTrial ? "probando" : "actual"}</span> : null}
              </p>
              {p.soon ? (
                <span className="rounded-full bg-[var(--gold,#c8a46b)]/20 px-2 py-0.5 text-xs font-medium">Próximamente</span>
              ) : (
                <p className="font-semibold tabular-nums">{formatArs(price(p))}</p>
              )}
            </div>
            <p className="text-sm text-muted">
              {p.limit ? `Hasta ${p.limit} alumnos activos` : "Alumnos ilimitados"} · {cycle === "annual" ? "por año" : "por mes"}
            </p>
          </button>
        ))}
      </div>

      {selected === "estudio" ? (
        <p className="text-sm text-muted">
          Estudio te suma más alumnos, eventos con entradas, formaciones con cuotas y audiciones, lista de espera, clase de
          prueba, cupones, gift cards y varios profes con permisos. Los referidos se suman sin costo extra apenas estén.
        </p>
      ) : null}

      {inTrial && selected !== currentPlan ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={trialPending}
            onClick={() => startTrial(async () => setTrialMsg(await chooseTrialPlan(selected)))}
            className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
          >
            {trialPending ? "Cambiando…" : "Probar este plan gratis durante la prueba"}
          </button>
          {trialMsg ? <FormMessage ok={trialMsg.ok} message={trialMsg.message} /> : null}
        </div>
      ) : null}

      <ActionForm action={formAction} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <input type="hidden" name="plan" value={selected} />
        <input type="hidden" name="cycle" value={cycle} />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">¿Tenés un código?</span>
          <Input name="coupon" placeholder="Ej.: FUNDADOR" autoCapitalize="characters" autoComplete="off" />
          {state.fieldErrors?.coupon ? <span className="block text-sm text-danger">{state.fieldErrors.coupon}</span> : null}
        </label>
        <FormMessage ok={false} message={state.message} />
        <Button type="submit" disabled={pending}>
          {pending ? "Abriendo Mercado Pago…" : "Suscribirme con Mercado Pago"}
        </Button>
        <p className="text-xs text-muted">
          Débito automático {cycle === "annual" ? "anual" : "mensual"} con Mercado Pago. Los precios se ajustan cada tres
          meses por inflación y te avisamos antes. Podés cancelar cuando quieras.
        </p>
      </ActionForm>
    </div>
  );
}
