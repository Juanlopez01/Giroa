import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Las condiciones para usar Giroa: planes, pagos, cancelación y responsabilidades.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Términos de uso">
      <p>
        Estos términos regulan el uso de Giroa, un servicio de {LEGAL.owner} (en adelante, “Giroa”) para que estudios de danza
        y disciplinas de movimiento gestionen sus clases, alumnos y cobros. Al crear una cuenta o usar Giroa, aceptás estos
        términos y la <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <h2>1. El servicio</h2>
      <p>
        Giroa ofrece a cada estudio una página propia, una app para sus alumnos y un panel de gestión (reservas, packs, cobros,
        asistencia, eventos, formaciones y más, según el plan). Lo que incluye cada plan está publicado en{" "}
        <Link href="/#planes">giroa.com.ar</Link>. Las funciones marcadas como “Próximamente” todavía no están disponibles.
      </p>

      <h2>2. Cuentas</h2>
      <ul>
        <li>Para usar el panel necesitás una cuenta con un email válido. Sos responsable de lo que se haga con tu cuenta.</li>
        <li>El dueño del estudio decide a quién suma al equipo y con qué permisos.</li>
        <li>Los datos que cargues tienen que ser verdaderos y tenés que tener derecho a usarlos.</li>
      </ul>

      <h2>3. Prueba, planes y pagos</h2>
      <ul>
        <li>Cada estudio nuevo tiene 14 días de prueba gratis, sin tarjeta.</li>
        <li>
          Después, el plan se paga por adelantado con débito automático de Mercado Pago, mensual o anual. Los precios están en
          pesos y se ajustan cada tres meses por inflación; te avisamos antes de cada ajuste.
        </li>
        <li>Si un cobro no se puede hacer, tenés 7 días para regularizarlo. Después, el panel queda pausado hasta que pagues; tus alumnos siguen pudiendo ver su saldo y reservar.</li>
        <li>Los códigos de descuento (por ejemplo, el de estudios fundadores) valen en las condiciones en que se otorgaron.</li>
      </ul>

      <h2>4. Comisiones y cobros a tus alumnos</h2>
      <ul>
        <li>
          <strong>Giroa no cobra comisión por tus ventas.</strong> Los pagos online de tus alumnos van directo a tu cuenta de
          Mercado Pago, que cobra sus propias comisiones según sus condiciones.
        </li>
        <li>
          Vos definís tus precios, tus packs y tus políticas de cancelación y devolución, y sos responsable frente a tus alumnos
          por lo que les vendés, incluidas las devoluciones y la facturación.
        </li>
        <li>El uso de Mercado Pago se rige también por los términos de Mercado Pago.</li>
      </ul>

      <h2>5. Cancelación</h2>
      <p>
        Podés cancelar tu suscripción cuando quieras desde el panel, en “Tu plan”, sin permanencia ni penalidades. No se
        devuelven los períodos ya pagados. Antes de irte, podés exportar tus alumnos y tus cobros desde el panel.
      </p>

      <h2>6. Tus datos</h2>
      <p>
        La información que cargás es tuya. Giroa la usa solo para prestarte el servicio, según la{" "}
        <Link href="/privacidad">Política de privacidad</Link>. Sos responsable de informar a tus alumnos y de contar con su
        consentimiento para cargar sus datos.
      </p>

      <h2>7. Uso aceptable</h2>
      <p>
        No está permitido usar Giroa para actividades ilegales, para enviar spam, para acceder a datos de otros estudios o para
        afectar el funcionamiento del servicio. Podemos suspender cuentas que incumplan estos términos.
      </p>

      <h2>8. Disponibilidad y responsabilidad</h2>
      <p>
        Trabajamos para que Giroa funcione siempre, pero puede haber interrupciones por mantenimiento o por fallas de terceros
        (por ejemplo, de Mercado Pago o de nuestros proveedores de servidores). En la medida que lo permita la ley, la
        responsabilidad de Giroa se limita al importe que hayas pagado por el servicio en los últimos tres meses.
      </p>

      <h2>9. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Si el cambio es importante, te avisamos por email con anticipación. Si no estás de
        acuerdo, podés cancelar tu suscripción.
      </p>

      <h2>10. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Para cualquier consulta, escribinos a{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalPage>
  );
}
