import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { logoUrl } from "@/lib/studio";
import { studioUrl } from "@/lib/urls";
import { checkinPath } from "@/lib/checkin";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { SmallAction } from "../../equipo/team-controls";
import { PrintButton } from "./print-button";
import { rotateCheckinCode } from "./actions";

export const metadata: Metadata = { title: "QR de asistencia" };

// Cartel para imprimir y pegar en la puerta: cada alumno lo escanea con la
// cámara del celu y se da el presente (clases y encuentros de formaciones).
export default async function CheckinPosterPage({ params }: PageProps<"/s/[slug]/panel/ajustes/qr">) {
  const { slug } = await params;
  const { studio, isAdmin } = await requireStaff(slug, "/panel/ajustes/qr");

  if (!(await can(studio.id, "qr_checkin"))) {
    return <UpgradeNotice feature="qr_checkin" what="El presente con QR" />;
  }

  const supabase = await createClient();
  const { data } = await supabase.from("studio_checkin_codes").select("code, rotated_at").eq("studio_id", studio.id).single();
  if (!data) return <p className="text-muted">No encontramos el QR del estudio. Probá de nuevo en un rato.</p>;

  const url = studioUrl(slug, checkinPath(data.code));
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1f1a17", light: "#ffffff" },
  });
  const logo = logoUrl(studio.logo_path);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1 print:hidden">
        <Link href="/panel/ajustes" className="text-sm text-muted hover:text-foreground">
          ← Ajustes
        </Link>
        <h1 className="text-2xl font-semibold">QR de asistencia</h1>
        <p className="text-muted">
          Imprimilo y pegalo en la entrada. Cada alumno lo escanea con la cámara del celu y se da el presente solo: en su clase
          o en el encuentro de su formación, desde 30 minutos antes hasta que termina.
        </p>
      </div>

      {/* El cartel (lo único que sale al imprimir). */}
      <article className="mx-auto flex aspect-[1/1.414] w-full flex-col items-center justify-between rounded-3xl border border-border bg-white p-8 text-center text-[#1f1a17] print:rounded-none print:border-0 print:p-[12mm]">
        <div className="flex flex-col items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-16 w-16 rounded-2xl object-contain" />
          ) : null}
          <p className="text-lg font-semibold tracking-wide uppercase" style={{ color: "var(--brand)" }}>
            {studio.name}
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-serif text-4xl font-semibold">Da tu presente</p>
          <p className="text-[#6f6259]">Escaneá con la cámara de tu celu</p>
        </div>
        <div
          className="w-3/4 max-w-80 rounded-3xl border-4 p-4"
          style={{ borderColor: "var(--brand)" }}
          // SVG generado en el servidor por la librería qrcode a partir de una URL nuestra.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="text-sm text-[#6f6259]">Hay que tener una clase reservada. Si no la reservaste, te deja reservar ahí mismo.</p>
      </article>

      <div className="flex flex-col items-start gap-4 print:hidden">
        <PrintButton />
        <p className="text-sm text-muted">
          ¿Lo querés en una tablet o en la tele del estudio? Abrí esta página ahí: el QR funciona igual en pantalla.
        </p>
        {isAdmin ? (
          <div className="space-y-1 rounded-2xl border border-border bg-surface p-4">
            <p className="font-medium">¿Alguien está usando una foto del cartel?</p>
            <p className="text-sm text-muted">Cambiá el QR: los carteles impresos antes dejan de funcionar y tenés que imprimir el nuevo.</p>
            <SmallAction
              run={rotateCheckinCode.bind(null, slug)}
              label="Cambiar el QR"
              confirmText="¿Cambiar el QR? Los carteles impresos dejan de funcionar."
              danger
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
