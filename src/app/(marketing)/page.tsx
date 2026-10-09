import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { platformUrl } from "@/lib/urls";
import { FounderForm } from "./founder-form";
import { HeroMockup } from "./hero-mockup";
import { PanelMockup } from "./panel-mockup";
import { Faq } from "./faq";
import { isPlanComingSoon } from "@/lib/gating";

export const metadata: Metadata = {
  title: { absolute: "Giroa · Reservas, packs y pagos para estudios de danza" },
  description:
    "Dejá de perseguir a los alumnos para que paguen y de anotar clases en un cuaderno. Reservas online, packs, pagos con Mercado Pago y balance de roles para danzas en pareja.",
};

// Lo que todavía no está construido se muestra como "Próximamente": nadie paga por algo que no existe.
const SOON = new Set([
  "Referidos",
  "Certificados y jurado en audiciones",
  "Liquidación de profes",
  "Multi-sede y dominio propio",
  "Facturación ARCA",
]);

const PLAN_COPY: Record<string, { tagline: string; features: string[]; highlight?: boolean }> = {
  profe: {
    tagline: "Para profes independientes",
    features: ["Hasta 20 alumnos activos", "Packs por link con Mercado Pago", "Tus alumnos reservan solos", "Balance de roles"],
  },
  inicial: {
    tagline: "Para arrancar ordenado",
    features: [
      "Hasta 50 alumnos activos",
      "Clases, packs y saldo de cada alumno",
      "Compra desde el celular con Mercado Pago",
      "Check-in con QR",
      "Balance de roles y cupo por equipo",
      "Panel de ingresos",
    ],
  },
  estudio: {
    tagline: "El estudio completo",
    highlight: true,
    features: [
      "Hasta 150 alumnos activos",
      "Todo lo de Inicial",
      "Eventos con entradas y control por QR",
      "Formaciones con cuotas y asistencia",
      "Audiciones con turnos y resultados",
      "Lista de espera y clase de prueba",
      "Cupones y gift cards",
      "Anuncios a tus alumnos",
      "Referidos",
      "Varios profes con permisos",
    ],
  },
  pro: {
    tagline: "Para crecer sin límites",
    features: [
      "Alumnos ilimitados",
      "Todo lo de Estudio",
      "Certificados y jurado en audiciones",
      "Liquidación de profes",
      "Multi-sede y dominio propio",
      "Facturación ARCA",
    ],
  },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("key, name, monthly_price_cents").order("sort");

  return (
    <main className="flex-1">
      {/* ------------------------------------------------------------ hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-16 sm:pt-16 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="mb-5 inline-block rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted">
            Para estudios de danza, yoga, pilates y profes independientes
          </p>
          <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Dejá de perseguir a los alumnos para que paguen y de anotar clases en un cuaderno.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Giroa ordena tu estudio: tus alumnos compran su pack con Mercado Pago, reservan solos desde el celular y vos
            sabés en todo momento quién pagó, quién debe y qué clases se llenan.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={platformUrl("/login?next=/onboarding")}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-medium text-brand-foreground"
            >
              Probá gratis 14 días
            </a>
            <a
              href="#fundadores"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-surface px-6 font-medium"
            >
              Quiero ser estudio fundador
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <MercadoPagoBadge />
            <span>Sin tarjeta para probar</span>
            <span>·</span>
            <span>Te migramos tu Excel</span>
          </div>
        </div>
        <HeroMockup />
      </section>

      {/* ------------------------------------------------------------ dos mensajes */}
      <section id="como-funciona" className="mx-auto grid max-w-6xl gap-5 px-5 pb-16 md:grid-cols-2">
        <article className="relative rounded-3xl border border-stone-200 bg-surface p-8 pt-10">
          <span className="absolute -top-3 left-8 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
            Para estudios
          </span>
          <h2 className="font-serif text-2xl font-semibold">Si tenés un estudio</h2>
          <p className="mt-2 text-muted">Orden, sin planillas ni cuadernos.</p>
          <ul className="mt-6 space-y-3">
            <li>✓ Quién pagó y quién debe, al día.</li>
            <li>✓ Qué clases se llenan y cuáles conviene cerrar.</li>
            <li>✓ Saldo de cada alumno: “te quedan 3 clases, vence el 12/11”.</li>
            <li>✓ Asistencia con el QR del alumno, desde el celular del profe.</li>
            <li>✓ Migración gratis desde tu Excel.</li>
          </ul>
        </article>
        <article className="relative rounded-3xl border border-stone-200 bg-surface p-8 pt-10">
          <span className="absolute -top-3 left-8 rounded-full border border-stone-200 bg-[var(--gold)] px-3 py-1 text-xs font-semibold text-foreground">
            Para profes
          </span>
          <h2 className="font-serif text-2xl font-semibold">Si sos profe independiente</h2>
          <p className="mt-2 text-muted">Tu propia app, aunque des clases en varios lugares.</p>
          <ul className="mt-6 space-y-3">
            <li>✓ Vendé tus packs por link con Mercado Pago.</li>
            <li>✓ Tus alumnos reservan solos, sin mensajes.</li>
            <li>✓ La plata va directo a tu cuenta.</li>
            <li>✓ Tu marca: tu logo y tu color.</li>
          </ul>
        </article>
      </section>

      {/* ------------------------------------------------------------ el panel del dueño */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-medium tracking-wide text-[var(--gold)] uppercase">Tu panel</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Abrís el panel y sabés cómo está tu estudio.</h2>
          <ul className="mt-6 space-y-3 text-muted">
            <li>✓ Lo cobrado en el mes, por efectivo, transferencia y Mercado Pago.</li>
            <li>✓ La clase en curso, con los presentes en vivo: los alumnos se lo dan solos con el QR del estudio.</li>
            <li>✓ A quién escribirle hoy: packs por vencer, quién viene sin saldo y quién probó y no volvió. WhatsApp en un toque.</li>
            <li>✓ Qué clases se llenan y cuáles conviene mover.</li>
            <li>✓ Se instala en el celu como una app, para el dueño y los profes.</li>
          </ul>
        </div>
        <PanelMockup />
      </section>

      {/* ------------------------------------------------------------ balance de roles */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium tracking-wide text-[var(--gold)] uppercase">Para danzas en pareja</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
              Balance de roles automático
            </h2>
            <p className="mt-4 text-muted">
              En tango, salsa, bachata o swing, cada alumno elige si va como líder o seguidor/a al reservar. Vos
              definís la diferencia máxima y Giroa no deja que la clase se desbalancee: nadie se queda sin pareja.
            </p>
          </div>
          <div className="space-y-3 rounded-3xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">Tango inicial · Lunes 19:00</p>
              <p className="text-sm text-muted">14/20</p>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="rounded-full bg-brand px-3 py-1 text-brand-foreground">8 líderes</span>
              <span className="rounded-full border border-border px-3 py-1">6 seguidores/as</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <span className="rounded-xl border border-border py-2.5 text-center text-sm text-muted line-through">
                Líder (lleno)
              </span>
              <span className="rounded-xl bg-brand py-2.5 text-center text-sm font-medium text-brand-foreground">
                Seguidor/a
              </span>
            </div>
            <p className="text-sm text-muted">“Por ahora no hay lugar como líder: faltan seguidores/as.”</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ planes */}
      <section id="planes" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">Planes</h2>
        <p className="mt-2 text-muted">
          Empezás con 14 días gratis, sin tarjeta. Después elegís tu plan y lo pagás con débito automático de Mercado
          Pago. Precios mensuales en pesos. Se ajustan cada tres meses por inflación, y te avisamos antes. Pagando el año,
          tenés 2 meses gratis.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(plans ?? []).map((p) => {
            const copy = PLAN_COPY[p.key];
            const soonPlan = isPlanComingSoon(p.key);
            return (
              <article
                key={p.key}
                className={`flex flex-col rounded-3xl border p-6 ${copy?.highlight ? "border-brand bg-surface ring-2 ring-brand/20" : soonPlan ? "border-dashed border-border bg-surface/60" : "border-border bg-surface"}`}
              >
                {copy?.highlight ? <p className="mb-2 text-xs font-semibold tracking-wide text-brand uppercase">El más elegido</p> : null}
                <h3 className="font-serif text-2xl font-semibold">{p.name}</h3>
                <p className="text-sm text-muted">{copy?.tagline}</p>
                {soonPlan ? (
                  <p className="mt-4">
                    <span className="inline-block rounded-full bg-[var(--gold)]/25 px-3 py-1 text-sm font-semibold text-foreground">Próximamente</span>
                  </p>
                ) : (
                  <p className="mt-4 text-3xl font-semibold tabular-nums">
                    {formatArs(p.monthly_price_cents)}
                    <span className="text-base font-normal text-muted">/mes</span>
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {copy?.features.map((f) => (
                    <li key={f} className={SOON.has(f) || soonPlan ? "text-muted" : undefined}>
                      {SOON.has(f) || soonPlan ? "○" : "✓"} {f}
                      {SOON.has(f) && !soonPlan ? (
                        <span className="ml-1.5 rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground">
                          Próximamente
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted">
          “Alumnos activos” son los que tienen un pack vigente o vinieron en los últimos 30 días. Lo que figura como
          “Próximamente” se suma a tu plan sin costo extra apenas esté listo.
        </p>
      </section>

      <Faq />

      {/* ------------------------------------------------------------ fundadores */}
      <section id="fundadores" className="bg-brand text-brand-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium tracking-wide text-[var(--gold)] uppercase">Plan fundadores</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
              Los primeros 10 estudios pagan la mitad. De por vida.
            </h2>
            <ul className="mt-6 space-y-3 opacity-90">
              <li>✓ 50% de descuento para siempre en cualquier plan.</li>
              <li>✓ Migramos tus alumnos y saldos desde Excel, gratis.</li>
              <li>✓ Te ayudamos a configurar todo en una videollamada.</li>
              <li>✓ Tu opinión define lo que construimos después.</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-background p-6 text-foreground">
            <FounderForm />
          </div>
        </div>
      </section>
    </main>
  );
}

/** Sello sutil de cobros con Mercado Pago (texto, sin el logo oficial). */
function MercadoPagoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#009ee3]/30 bg-[#009ee3]/10 px-3 py-1 font-medium text-[#0b6aa6]">
      <span aria-hidden className="h-2 w-2 rounded-full bg-[#009ee3]" />
      Cobros con Mercado Pago
    </span>
  );
}
