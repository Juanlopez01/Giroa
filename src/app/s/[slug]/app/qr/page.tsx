import type { Metadata } from "next";
import QRCode from "qrcode";
import { requireStudent } from "@/lib/student-app";

export const metadata: Metadata = { title: "Mi QR" };

// El QR lleva el qr_token del alumno (aleatorio, no el id interno). El staff lo
// escanea en la clase y check_in_by_qr lo marca presente.
export default async function StudentQrPage({ params }: PageProps<"/s/[slug]/app/qr">) {
  const { slug } = await params;
  const { student } = await requireStudent(slug, "/app/qr");

  const svg = await QRCode.toString(`giroa:${student.qr_token}`, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1917", light: "#ffffff" },
  });

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tu QR</h1>
        <p className="text-muted">Mostralo al llegar a la clase para que te marquen presente.</p>
      </div>
      <div
        className="mx-auto w-full max-w-72 rounded-3xl border border-border bg-white p-5"
        // SVG generado en el servidor por la librería qrcode a partir de un token hex.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-lg font-semibold">{student.full_name}</p>
      <p className="text-sm text-muted">Subí el brillo de la pantalla si cuesta leerlo.</p>
    </div>
  );
}
