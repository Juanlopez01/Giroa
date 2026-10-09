import type { Metadata } from "next";
import { LEGAL, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo trata Giroa los datos personales de los estudios y de sus alumnos (Ley 25.326).",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        Esta política explica qué datos personales se tratan en Giroa, para qué y cómo podés ejercer tus derechos, de acuerdo
        con la Ley 25.326 de Protección de los Datos Personales y su normativa complementaria.
      </p>

      <h2>1. Quién es responsable</h2>
      <p>
        Giroa es un servicio de {LEGAL.owner} (en adelante, “Giroa”). Contacto: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
      <ul>
        <li>
          <strong>Datos de los estudios</strong> (dueños, encargados y profes que usan el panel): Giroa es el responsable del
          tratamiento.
        </li>
        <li>
          <strong>Datos de los alumnos</strong> de cada estudio: el responsable es el estudio, que decide qué datos carga y para
          qué. Giroa los trata por cuenta y orden del estudio, solo para prestarle el servicio (encargado del tratamiento).
        </li>
      </ul>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>De cuenta: nombre, email, celular y rol en el estudio.</li>
        <li>De los alumnos: nombre, email, celular, rol de baile (si corresponde), reservas, asistencias, packs y saldo.</li>
        <li>
          De pagos: importe, fecha, medio y referencia del pago. <strong>Giroa no ve ni guarda datos de tarjetas</strong>: los pagos
          online los procesa Mercado Pago.
        </li>
        <li>En formaciones y audiciones: las respuestas del formulario, el link al video y el material que comparta el estudio.</li>
        <li>Técnicos: los necesarios para que el servicio funcione y sea seguro (por ejemplo, la cookie de sesión).</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Prestar el servicio: reservas, cobros, asistencia, formaciones, eventos y avisos por email.</li>
        <li>Gestionar la suscripción del estudio a Giroa.</li>
        <li>Dar soporte y responder consultas.</li>
        <li>Mantener la seguridad y prevenir usos indebidos.</li>
      </ul>
      <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>

      <h2>4. Con quién los compartimos</h2>
      <p>Solo con proveedores que necesitamos para prestar el servicio, y para eso:</p>
      <ul>
        <li>Supabase (base de datos y archivos) y Vercel (servidores de la aplicación).</li>
        <li>Mercado Pago (cobros a los alumnos y suscripción de los estudios).</li>
        <li>Resend (envío de emails).</li>
      </ul>
      <p>
        Algunos de estos proveedores procesan datos fuera de la Argentina (por ejemplo, en Brasil o en Estados Unidos), con
        medidas de seguridad adecuadas. Al usar Giroa, prestás tu consentimiento para esa transferencia.
      </p>

      <h2>5. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras el estudio tenga su cuenta activa. Si el estudio se da de baja, puede exportar sus datos desde el panel y
        pedirnos que los borremos; los eliminamos dentro de los 30 días, salvo lo que debamos conservar por obligaciones
        legales o contables.
      </p>

      <h2>6. Seguridad</h2>
      <p>
        Cada estudio tiene su información separada y nadie de otro estudio puede verla. Usamos conexiones cifradas, control de
        acceso por rol, y los archivos privados (como el material de las formaciones) se abren con links que vencen.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Podés pedir acceso, rectificación, actualización o supresión de tus datos escribiendo a{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Si sos alumno de un estudio, también podés pedírselo directamente
        al estudio. Respondemos dentro de los plazos de la Ley 25.326 (10 días corridos para el acceso y 5 días hábiles para la
        rectificación o supresión).
      </p>
      <p>
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a
        intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en
        el artículo 14, inciso 3 de la Ley N° 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano
        de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes
        resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos
        personales.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        Si un estudio carga datos de alumnos menores de edad, es responsabilidad del estudio contar con la autorización de sus
        padres o tutores.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Usamos solo las cookies necesarias para que inicies sesión y la aplicación funcione. No usamos cookies de publicidad.
      </p>

      <h2>10. Cambios</h2>
      <p>
        Si cambiamos esta política, lo vamos a avisar en esta página y, si el cambio es importante, por email a los estudios.
      </p>
    </LegalPage>
  );
}
