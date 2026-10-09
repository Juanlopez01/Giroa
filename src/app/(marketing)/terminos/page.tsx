import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Las reglas para usar Giroa: cuentas, uso permitido, datos y responsabilidades.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Términos de uso">
      <p>
        Estos términos regulan el uso de Giroa, un servicio de {LEGAL.owner} (en adelante, “Giroa”, “nosotros”) para que
        estudios, escuelas y profes de danza y disciplinas de movimiento gestionen sus clases, alumnos y cobros. Al crear una
        cuenta o usar Giroa aceptás estos términos, las <Link href="/condiciones">Condiciones de contratación</Link> y la{" "}
        <Link href="/privacidad">Política de privacidad</Link>. Si no estás de acuerdo, no uses el servicio.
      </p>

      <h2>1. Definiciones</h2>
      <ul>
        <li>
          <strong>Estudio:</strong> la persona o empresa que crea una cuenta para gestionar su actividad (incluye a profes
          independientes).
        </li>
        <li>
          <strong>Equipo:</strong> las personas que el Estudio suma a su panel (encargados y profes).
        </li>
        <li>
          <strong>Alumno:</strong> quien reserva clases, compra packs o entradas, o participa de formaciones de un Estudio.
        </li>
        <li>
          <strong>Servicio:</strong> la página del Estudio, la app de los Alumnos, el panel de gestión y todo lo que Giroa ofrece.
        </li>
      </ul>

      <h2>2. El servicio</h2>
      <p>
        Giroa es una herramienta de software. No es parte de la relación entre el Estudio y sus Alumnos: no da clases, no
        vende packs por cuenta propia ni fija precios. Lo que incluye cada plan está publicado en{" "}
        <Link href="/#planes">giroa.com.ar</Link>; las funciones marcadas como “Próximamente” todavía no están disponibles.
        Podemos mejorar, cambiar o dejar de ofrecer funciones, avisando con anticipación cuando el cambio sea importante.
      </p>

      <h2>3. Cuentas</h2>
      <ul>
        <li>Para usar Giroa necesitás un email válido. Entrás con un link que te mandamos, sin contraseña.</li>
        <li>Sos responsable de lo que se haga desde tu cuenta y de mantener seguro el acceso a tu email.</li>
        <li>El dueño del Estudio decide quién integra su Equipo y con qué permisos, y responde por lo que haga su Equipo.</li>
        <li>Los datos que cargues tienen que ser verdaderos y tenés que tener derecho a usarlos.</li>
        <li>Para crear un Estudio tenés que ser mayor de edad.</li>
      </ul>

      <h2>4. Obligaciones del Estudio</h2>
      <ul>
        <li>
          Cumplir las normas que se apliquen a su actividad: defensa del consumidor, facturación e impuestos, protección de
          datos personales y las propias de su disciplina.
        </li>
        <li>
          Informar a sus Alumnos sus precios, condiciones de compra, cancelación y devolución, y responder ante ellos por las
          clases, packs, entradas y formaciones que vende.
        </li>
        <li>
          Contar con el consentimiento de sus Alumnos para cargar sus datos, y con el de padres o tutores en el caso de
          menores de edad.
        </li>
        <li>Mantener actualizada su cuenta de Mercado Pago si cobra online.</li>
      </ul>

      <h2>5. Uso permitido</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Usar Giroa para actividades ilegales o para vender productos o servicios prohibidos.</li>
        <li>Enviar spam o mensajes no solicitados a través del servicio.</li>
        <li>Intentar acceder a datos de otros Estudios o de otras personas, o a partes del sistema sin autorización.</li>
        <li>Afectar el funcionamiento del servicio, copiarlo, revenderlo o usarlo para armar uno competidor.</li>
        <li>Subir contenido que infrinja derechos de terceros o que sea ofensivo, discriminatorio o engañoso.</li>
      </ul>
      <p>Si se incumplen estas reglas, podemos suspender o dar de baja la cuenta, avisando cuando sea posible.</p>

      <h2>6. Contenido y datos</h2>
      <p>
        El contenido y los datos que cargás (alumnos, clases, material, imágenes) son tuyos. Nos das permiso para guardarlos,
        procesarlos y mostrarlos solo en la medida necesaria para prestarte el Servicio. Podés exportarlos desde el panel en
        cualquier momento. El tratamiento de datos personales se rige por la <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        El software, la marca Giroa, el diseño y los textos del Servicio son de Giroa. Estos términos no te dan ningún derecho
        sobre ellos más allá de usar el Servicio mientras tengas una cuenta.
      </p>

      <h2>8. Pagos de los Alumnos</h2>
      <p>
        Los cobros online a los Alumnos se procesan con la cuenta de Mercado Pago del Estudio y se rigen también por los
        términos de Mercado Pago. Giroa no recibe ni retiene ese dinero, y no es responsable por demoras, rechazos, contracargos
        o devoluciones, que el Estudio gestiona con Mercado Pago y con sus Alumnos.
      </p>

      <h2>9. Disponibilidad</h2>
      <p>
        Trabajamos para que Giroa funcione siempre, pero puede haber interrupciones por mantenimiento, actualizaciones o fallas
        de terceros (por ejemplo, de Mercado Pago, del proveedor de emails o de los servidores). No garantizamos que el
        Servicio esté libre de errores ni disponible sin interrupciones.
      </p>

      <h2>10. Responsabilidad</h2>
      <p>
        El Servicio se ofrece “tal como está”. En la medida que lo permita la ley, Giroa no responde por daños indirectos,
        lucro cesante o pérdida de datos causados por el uso o la imposibilidad de usar el Servicio, y su responsabilidad total
        se limita al importe que el Estudio haya pagado a Giroa en los tres meses anteriores al hecho. Nada de esto limita los
        derechos que la ley reconoce a los consumidores.
      </p>

      <h2>11. Baja de la cuenta</h2>
      <p>
        Podés dejar de usar Giroa cuando quieras (ver <Link href="/condiciones">Condiciones de contratación</Link>). Nosotros
        también podemos dar de baja una cuenta por incumplimiento de estos términos o por falta de pago, según lo que indican
        las condiciones.
      </p>

      <h2>12. Cambios en estos términos</h2>
      <p>
        Podemos actualizar estos términos. Publicamos la versión vigente en esta página con su fecha y, si el cambio es
        importante, te avisamos por email con anticipación. Si seguís usando Giroa después del cambio, se entiende que lo
        aceptás.
      </p>

      <h2>13. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Ante cualquier conflicto, primero intentamos
        resolverlo de buena fe; si no es posible, intervienen los tribunales ordinarios competentes. Contacto:{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalPage>
  );
}
