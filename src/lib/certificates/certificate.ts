// Certificados: datos públicos (get_certificate) y textos. Funciones puras.

export type CertificateData = {
  code: string;
  studentName: string;
  formationTitle: string;
  certificateText: string | null;
  signerName: string | null;
  signerRole: string | null;
  completedOn: string;
  revoked: boolean;
  studioSlug: string;
  studioName: string;
  brandColor: string;
  logoPath: string | null;
};

/** Lo que devuelve get_certificate (jsonb) → tipado, o null si no existe. */
export function parseCertificate(raw: unknown): CertificateData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
  const code = str("code");
  const studentName = str("student_name");
  const formationTitle = str("formation_title");
  const completedOn = str("completed_on");
  const studioSlug = str("studio_slug");
  const studioName = str("studio_name");
  if (!code || !studentName || !formationTitle || !completedOn || !studioSlug || !studioName) return null;
  return {
    code,
    studentName,
    formationTitle,
    certificateText: str("certificate_text"),
    signerName: str("signer_name"),
    signerRole: str("signer_role"),
    completedOn,
    revoked: r.revoked === true,
    studioSlug,
    studioName,
    brandColor: /^#[0-9a-f]{6}$/i.test(str("brand_color") ?? "") ? str("brand_color")! : "#7a2e3a",
    logoPath: str("logo_path"),
  };
}

/** Códigos con la forma CERT-XXXX-XXXX (para validar la URL antes de ir a la base). */
export function isCertificateCode(value: string): boolean {
  return /^CERT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/i.test(value);
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-12-12" → "12 de diciembre de 2026". */
export function certificateDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** Nombre del archivo: certificado-profesorado-de-tango-ana-gomez.pdf */
export function certificateFileName(c: Pick<CertificateData, "formationTitle" | "studentName">): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `certificado-${slug(c.formationTitle)}-${slug(c.studentName)}`.slice(0, 120) + ".pdf";
}
