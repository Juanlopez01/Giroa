// Preguntas frecuentes de la landing, ordenadas de la objeción más fuerte a la
// más chica. También van como datos estructurados (FAQPage) para Google.
export const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Giroa cobra comisión por cada venta?",
    a: "No. Pagás solo tu plan mensual, vendas lo que vendas. Mercado Pago cobra su comisión habitual por cada cobro, igual que si cobraras por tu cuenta, pero Giroa no se queda con nada de lo que vendés.",
  },
  {
    q: "¿La plata pasa por Giroa?",
    a: "No. Vinculás tu propia cuenta de Mercado Pago y cada pago de tus alumnos va directo a tu cuenta, como siempre. Nosotros no tocamos tu plata.",
  },
  {
    q: "¿Mis alumnos tienen que bajarse una app?",
    a: "No. Entran desde un link, que podés mandar por WhatsApp o poner en tu Instagram, y ya pueden reservar y comprar packs. Si quieren, lo agregan a la pantalla de inicio del celular y queda como una app más.",
  },
  {
    q: "¿Qué pasa si un alumno me paga en efectivo o por transferencia?",
    a: "Lo cargás en el panel en dos clicks y el pack se acredita igual. Así tenés todo en un solo lugar, cobre como cobre.",
  },
  {
    q: "¿Es difícil empezar? No me llevo bien con la tecnología.",
    a: "Para nada. Si tenés tus alumnos en un Excel o un cuaderno, te los pasamos nosotros, gratis. Y si sos estudio fundador, te ayudamos a configurar todo en una videollamada.",
  },
  {
    q: "¿Puedo probarlo antes de pagar?",
    a: "Sí. Tenés 14 días gratis, sin cargar tarjeta. Si te sirve, elegís tu plan; si no, no pasa nada.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, sin permanencia ni penalidades. Lo cancelás desde el panel, en “Tu plan”, y listo.",
  },
  {
    q: "¿Qué pasa con mis datos si me voy?",
    a: "Son tuyos. Te podés llevar tus alumnos con sus saldos y tus pagos en un archivo para Excel cuando quieras, desde el panel.",
  },
  {
    q: "¿Sirve para yoga, pilates u otras disciplinas?",
    a: "Sí. Giroa nació en la danza, pero funciona para cualquier estudio de clases. En pilates ponés el cupo de cada clase según la cantidad de máquinas, y en las danzas de pareja tenés el balance de roles. Cada clase usa solo lo que necesita.",
  },
  {
    q: "Doy clases en varios lugares, ¿me sirve?",
    a: "Sí, para eso está el plan Profe. Tus alumnos te siguen a vos, no a la sala: ven todas tus clases en un solo lugar y compran tus packs, des clase donde des.",
  },
  {
    q: "¿Mis datos y los de mis alumnos están seguros?",
    a: "Cada estudio tiene su información separada y nadie más puede verla. Los pagos se procesan en Mercado Pago, así que Giroa nunca ve ni guarda datos de tarjetas.",
  },
];

export function Faq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <section id="preguntas" className="mx-auto max-w-3xl px-5 py-16">
      <h2 className="font-serif text-3xl font-semibold sm:text-4xl">Preguntas frecuentes</h2>
      <div className="mt-8 divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.q}
              <span aria-hidden className="shrink-0 text-xl leading-none text-muted transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        // Datos estructurados armados con textos nuestros (sin entrada del usuario).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
