import { describe, expect, it } from "vitest";
import { certificateDate, certificateFileName, isCertificateCode, parseCertificate } from "@/lib/certificates/certificate";

describe("certificados", () => {
  it("valida el código antes de ir a la base", () => {
    expect(isCertificateCode("CERT-AB2C-XY9Z")).toBe(true);
    expect(isCertificateCode("cert-ab2c-xy9z")).toBe(true);
    expect(isCertificateCode("CERT-AB0C-XY9Z")).toBe(false); // sin 0 ni O ni I ni L ni 1
    expect(isCertificateCode("REGALO-AB2C-XY9Z")).toBe(false);
  });

  it("lee lo que devuelve get_certificate", () => {
    const c = parseCertificate({
      code: "CERT-AB2C-XY9Z",
      student_name: "Ana Gómez",
      formation_title: "Profesorado",
      certificate_text: null,
      signer_name: "Lucía",
      signer_role: null,
      completed_on: "2026-12-12",
      revoked: false,
      studio_slug: "demo",
      studio_name: "Tango del Sur",
      brand_color: "javascript:alert(1)",
      logo_path: null,
    });
    expect(c).toMatchObject({ studentName: "Ana Gómez", brandColor: "#7a2e3a", revoked: false });
    expect(parseCertificate(null)).toBeNull();
    expect(parseCertificate({ code: "x" })).toBeNull();
  });

  it("fecha y nombre del archivo", () => {
    expect(certificateDate("2026-12-02")).toBe("2 de diciembre de 2026");
    expect(certificateFileName({ formationTitle: "Profesorado de Tango", studentName: "Ana Gómez Ñuñez" })).toBe(
      "certificado-profesorado-de-tango-ana-gomez-nunez.pdf",
    );
  });
});
