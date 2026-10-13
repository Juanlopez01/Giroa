import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, CircleX, Download } from "lucide-react";
import { getStudioBySlug } from "@/lib/studio.server";
import { getCertificate } from "@/lib/certificates/certificate.server";
import { certificateDate } from "@/lib/certificates/certificate";
import { StudioHeader } from "@/components/studio/studio-header";

export async function generateMetadata({ params }: PageProps<"/s/[slug]/certificado/[code]">): Promise<Metadata> {
  const { slug, code } = await params;
  const c = await getCertificate(slug, code);
  return {
    title: c ? `Certificado de ${c.studentName}` : "Certificado",
    description: c && !c.revoked ? `${c.studentName} completó ${c.formationTitle} en ${c.studioName}.` : undefined,
    robots: { index: false },
  };
}

// Verificación pública: quien recibe el link o escanea el QR ve si es válido.
export default async function CertificatePage({ params }: PageProps<"/s/[slug]/certificado/[code]">) {
  const { slug, code } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();
  const c = await getCertificate(slug, code);
  if (!c) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-8">
        {c.revoked ? (
          <div className="space-y-2 rounded-3xl border border-border bg-surface p-6 text-center">
            <CircleX className="mx-auto h-10 w-10 text-danger" aria-hidden />
            <p className="font-serif text-2xl font-semibold">Certificado anulado</p>
            <p className="text-muted">
              {studio.name} anuló el certificado {c.code}. Si tenés dudas, consultá con el estudio.
            </p>
          </div>
        ) : (
          <>
            <article className="space-y-4 rounded-3xl border border-border bg-surface p-6 text-center">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                <BadgeCheck className="h-4 w-4" aria-hidden /> Certificado válido
              </p>
              <p className="text-muted">Se certifica que</p>
              <p className="font-serif text-3xl font-semibold">{c.studentName}</p>
              <p className="text-muted">completó la formación</p>
              <p className="font-serif text-2xl font-semibold text-brand">{c.formationTitle}</p>
              {c.certificateText ? <p className="text-sm text-muted italic">{c.certificateText}</p> : null}
              <p className="text-sm text-muted">
                en {c.studioName}, el {certificateDate(c.completedOn)}.
              </p>
              {c.signerName ? (
                <p className="text-sm">
                  Firma <span className="font-medium">{c.signerName}</span>
                  {c.signerRole ? `, ${c.signerRole}` : ""}
                </p>
              ) : null}
              <p className="font-mono text-sm tracking-wider text-muted">{c.code}</p>
            </article>
            <a
              href={`/certificado/${c.code}/pdf?descargar`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-foreground"
            >
              <Download className="h-5 w-5" aria-hidden /> Descargar PDF
            </a>
          </>
        )}
      </main>
    </div>
  );
}
