import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Condiciones de contratación",
  description: "Planes, prueba gratis, precios, débito automático, cancelación y arrepentimiento en Giroa.",
};

export default function ConditionsPage() {
  return (
    <LegalPage title="Condiciones de contratación">
      <p>
        Estas condiciones explican cómo se contrata y se paga Giroa. Se suman a los <Link href="/terminos">Términos de uso</Link>{" "}
        y a la <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <h2>1. Planes</h2>
      <p>
        Giroa se ofrece en planes con distintas funciones y límites de alumnos activos, publicados en{" "}
        <Link href="/#planes">giroa.com.ar</Link>. “Alumnos activos” son los que tienen un pack vigente o vinieron a clase en
        los últimos 30 días. Si llegás al límite de tu plan, podés seguir usando todo, pero no vas a poder sumar alumnos nuevos
        hasta pasar a un plan mayor. Los alumnos que ya tenés nunca se bloquean.
      </p>

      <h2>2. Prueba gratis</h2>
      <p>
        Cada Estudio nuevo tiene 14 días de prueba gratis, sin cargar tarjeta. Durante la prueba podés elegir qué plan probar.
        Al terminar, si no te suscribiste, tenés 7 días más para elegir un plan; después el panel queda pausado hasta que te
        suscribas. Tus alumnos siguen reservando y tus datos se conservan.
      </p>

      <h2>3. Precio y forma de pago</h2>
      <ul>
        <li>Los precios están en pesos argentinos e incluyen los impuestos que correspondan.</li>
        <li>
          El plan se paga por adelantado con débito automático de Mercado Pago, mensual o anual. El plan anual equivale a diez
          meses (dos meses gratis).
        </li>
        <li>
          Los precios se ajustan cada tres meses por inflación. Te avisamos por email con al menos 10 días de anticipación; si no
          estás de acuerdo, podés cancelar antes de que rija el precio nuevo.
        </li>
        <li>Los códigos de descuento (por ejemplo, el de estudios fundadores) valen en las condiciones en que se otorgaron.</li>
      </ul>

      <h2>4. Sin comisiones por tus ventas</h2>
      <p>
        Giroa no cobra comisión por las ventas del Estudio. Lo único que pagás es tu plan. Mercado Pago cobra sus propias
        comisiones por cada cobro online, según sus condiciones, igual que si cobraras por tu cuenta.
      </p>

      <h2>5. Falta de pago</h2>
      <p>
        Si un débito no se puede cobrar, tenés 7 días para regularizarlo. Pasado ese plazo, el panel queda pausado hasta que
        pagues: tus alumnos siguen viendo su saldo y reservando, y tus datos se conservan. Si la cuenta sigue impaga por más de
        90 días, podemos darla de baja, avisándote antes por email para que puedas exportar tus datos.
      </p>

      <h2>6. Cambio de plan</h2>
      <p>
        Podés cambiar de plan desde el panel, en “Tu plan”. El plan nuevo empieza a regir con la nueva suscripción y la anterior
        se cancela automáticamente.
      </p>

      <h2>7. Cancelación</h2>
      <p>
        Podés cancelar tu suscripción cuando quieras desde el panel, en “Tu plan”, sin permanencia ni penalidades. El débito se
        detiene y conservás el acceso hasta el final del período que ya pagaste. Antes de irte podés exportar tus alumnos y tus
        cobros. Si después querés que borremos tus datos, escribinos a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>

      <h2>8. Devoluciones</h2>
      <p>
        No se devuelven los períodos ya pagados, salvo en el caso del arrepentimiento (punto 9) o cuando la ley lo disponga. Si
        hubo un cobro por error, escribinos y lo revisamos.
      </p>

      <h2 id="arrepentimiento">9. Derecho de arrepentimiento</h2>
      <p>
        Si contrataste como consumidor, tenés derecho a revocar la contratación dentro de los 10 días corridos desde que te
        suscribiste, sin costo ni necesidad de explicar el motivo (artículo 34 de la Ley 24.240 de Defensa del Consumidor y
        artículo 1110 del Código Civil y Comercial). Para hacerlo, escribinos a{" "}
        <a href={`mailto:${LEGAL.email}?subject=Arrepentimiento`}>{LEGAL.email}</a> con el asunto “Arrepentimiento” y el nombre
        de tu estudio: cancelamos la suscripción y te devolvemos lo cobrado.
      </p>

      <h2>10. Facturación</h2>
      <p>
        Si necesitás factura por tu suscripción, escribinos con tus datos fiscales. La facturación de lo que el Estudio les
        vende a sus alumnos es responsabilidad del Estudio.
      </p>

      <h2>11. Consultas y reclamos</h2>
      <p>
        Para cualquier consulta o reclamo escribinos a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> y te respondemos lo
        antes posible. Si sos consumidor, también podés acudir a la autoridad de Defensa del Consumidor de tu jurisdicción o a{" "}
        <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor" target="_blank" rel="noopener noreferrer">
          Defensa del Consumidor de la Nación
        </a>
        .
      </p>
    </LegalPage>
  );
}
