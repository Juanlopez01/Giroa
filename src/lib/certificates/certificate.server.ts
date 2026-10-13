import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isCertificateCode, parseCertificate, type CertificateData } from "@/lib/certificates/certificate";

/** El certificado con ese código, si es de este estudio (público: lo ve cualquiera con el código). */
export async function getCertificate(slug: string, code: string): Promise<CertificateData | null> {
  if (!isCertificateCode(code)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_certificate", { p_code: code });
  const c = parseCertificate(data);
  return c && c.studioSlug === slug ? c : null;
}
