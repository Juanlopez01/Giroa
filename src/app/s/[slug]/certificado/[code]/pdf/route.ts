import { NextResponse } from "next/server";
import { getCertificate } from "@/lib/certificates/certificate.server";
import { certificateFileName } from "@/lib/certificates/certificate";
import { renderCertificatePdf } from "@/lib/certificates/pdf";
import { logoUrl } from "@/lib/studio";
import { studioUrl } from "@/lib/urls";

// El PDF del certificado (público con el código, igual que la página de verificación).
export async function GET(request: Request, { params }: RouteContext<"/s/[slug]/certificado/[code]/pdf">) {
  const { slug, code } = await params;
  const c = await getCertificate(slug, code);
  if (!c || c.revoked) return new NextResponse("No encontramos ese certificado.", { status: 404 });

  // El logo solo si es PNG o JPG (lo que sabe embeber el PDF); si no, va el nombre.
  let logo: { bytes: Uint8Array; type: "png" | "jpg" } | null = null;
  const url = logoUrl(c.logoPath);
  if (url) {
    const res = await fetch(url).catch(() => null);
    const type = res?.headers.get("content-type") ?? "";
    if (res?.ok && (type.includes("png") || type.includes("jpeg"))) {
      logo = { bytes: new Uint8Array(await res.arrayBuffer()), type: type.includes("png") ? "png" : "jpg" };
    }
  }

  const pdf = await renderCertificatePdf(c, { verifyUrl: studioUrl(slug, `/certificado/${c.code}`), logo });
  const download = new URL(request.url).searchParams.has("descargar");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${certificateFileName(c)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
