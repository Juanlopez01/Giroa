import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { certificateDate, type CertificateData } from "@/lib/certificates/certificate";

const FONTS = path.join(process.cwd(), "src/lib/certificates/fonts");

function hexToRgb(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Achica la letra hasta que el texto entre en el ancho. */
function fit(font: PDFFont, text: string, size: number, maxWidth: number): number {
  let s = size;
  while (s > 10 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 1;
  return s;
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = rgb(0.12, 0.1, 0.09)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

/**
 * Certificado en A4 apaisado: logo o nombre del estudio, el nombre del alumno,
 * la formación, el texto, la fecha, la firma y un QR para verificarlo.
 */
export async function renderCertificatePdf(
  c: CertificateData,
  opts: { verifyUrl: string; logo: { bytes: Uint8Array; type: "png" | "jpg" } | null },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Certificado · ${c.formationTitle} · ${c.studentName}`);
  doc.setAuthor(c.studioName);
  doc.setCreator("Giroa");

  const font = async (file: string) => doc.embedFont(await readFile(path.join(FONTS, file)), { subset: true });
  const [regular, semibold, italic] = await Promise.all([font("Fraunces-Regular.ttf"), font("Fraunces-SemiBold.ttf"), font("Fraunces-Italic.ttf")]);

  const page = doc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const brand = hexToRgb(c.brandColor);
  const muted = rgb(0.43, 0.38, 0.35);

  // Marco doble con el color del estudio.
  page.drawRectangle({ x: 22, y: 22, width: width - 44, height: height - 44, borderColor: brand, borderWidth: 2.5 });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: brand, borderWidth: 0.6, opacity: 0 });

  // Arriba: logo (si se puede embeber) o el nombre del estudio.
  let y = height - 78;
  const logo = opts.logo
    ? await (opts.logo.type === "png" ? doc.embedPng(opts.logo.bytes) : doc.embedJpg(opts.logo.bytes)).catch(() => null)
    : null;
  if (logo) {
    const scale = Math.min(150 / logo.width, 48 / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, { x: (width - w) / 2, y: y - h + 20, width: w, height: h });
    y -= h + 8;
  } else {
    centered(page, c.studioName, y, semibold, fit(semibold, c.studioName, 20, 600), brand);
    y -= 30;
  }

  centered(page, "C E R T I F I C A D O", y - 18, semibold, 15, brand);
  centered(page, "Se certifica que", y - 58, italic, 15, muted);

  const nameSize = fit(semibold, c.studentName, 40, width - 160);
  centered(page, c.studentName, y - 112, semibold, nameSize);
  page.drawLine({ start: { x: width / 2 - 170, y: y - 124 }, end: { x: width / 2 + 170, y: y - 124 }, thickness: 0.6, color: brand });

  centered(page, "completó la formación", y - 156, regular, 15, muted);
  const titleSize = fit(semibold, c.formationTitle, 26, width - 160);
  centered(page, c.formationTitle, y - 192, semibold, titleSize, brand);

  let ty = y - 222;
  if (c.certificateText) {
    for (const line of wrap(italic, c.certificateText, 13, width - 220).slice(0, 2)) {
      centered(page, line, ty, italic, 13, muted);
      ty -= 18;
    }
  }
  centered(page, `en ${c.studioName}, el ${certificateDate(c.completedOn)}.`, ty - 4, regular, 13, muted);

  // Abajo a la izquierda: la firma.
  if (c.signerName) {
    page.drawLine({ start: { x: 90, y: 112 }, end: { x: 300, y: 112 }, thickness: 0.6, color: muted });
    page.drawText(c.signerName, { x: 90, y: 94, size: 13, font: semibold });
    if (c.signerRole) page.drawText(c.signerRole, { x: 90, y: 78, size: 11, font: regular, color: muted });
  }

  // Abajo a la derecha: QR y código para verificarlo.
  const qr = await doc.embedPng(await QRCode.toBuffer(opts.verifyUrl, { type: "png", margin: 0, width: 240 }));
  page.drawImage(qr, { x: width - 90 - 64, y: 66, width: 64, height: 64 });
  const codeW = semibold.widthOfTextAtSize(c.code, 10);
  page.drawText(c.code, { x: width - 90 - 64 - 14 - codeW, y: 104, size: 10, font: semibold });
  const verify = "Verificalo escaneando el QR";
  page.drawText(verify, { x: width - 90 - 64 - 14 - regular.widthOfTextAtSize(verify, 9), y: 90, size: 9, font: regular, color: muted });

  page.drawText("Emitido con Giroa", { x: width / 2 - regular.widthOfTextAtSize("Emitido con Giroa", 8) / 2, y: 44, size: 8, font: regular, color: muted });
  return doc.save();
}
