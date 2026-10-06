import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMpSignature } from "@/lib/mp/signature";

const secret = "clave-webhook-de-prueba";
const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

describe("firma x-signature de Mercado Pago", () => {
  const ts = "1791200000";
  const header = `ts=${ts},v1=${sign(`id:123456;request-id:req-1;ts:${ts};`)}`;

  it("acepta una firma válida", () => {
    expect(verifyMpSignature({ signatureHeader: header, requestId: "req-1", dataId: "123456", secret })).toBe(true);
  });

  it("rechaza si cambia el id del pago", () => {
    expect(verifyMpSignature({ signatureHeader: header, requestId: "req-1", dataId: "999", secret })).toBe(false);
  });

  it("rechaza si cambia el request-id", () => {
    expect(verifyMpSignature({ signatureHeader: header, requestId: "otro", dataId: "123456", secret })).toBe(false);
  });

  it("rechaza con otra clave", () => {
    expect(verifyMpSignature({ signatureHeader: header, requestId: "req-1", dataId: "123456", secret: "x" })).toBe(false);
  });

  it("rechaza headers vacíos o mal formados", () => {
    expect(verifyMpSignature({ signatureHeader: null, requestId: "req-1", dataId: "123456", secret })).toBe(false);
    expect(verifyMpSignature({ signatureHeader: "ts=1", requestId: "req-1", dataId: "123456", secret })).toBe(false);
    expect(verifyMpSignature({ signatureHeader: "basura", requestId: null, dataId: null, secret })).toBe(false);
  });

  it("pasa el id alfanumérico a minúsculas como MP", () => {
    const h = `ts=${ts},v1=${sign(`id:abc123;request-id:r;ts:${ts};`)}`;
    expect(verifyMpSignature({ signatureHeader: h, requestId: "r", dataId: "ABC123", secret })).toBe(true);
  });

  it("rechaza notificaciones viejas si se pide antigüedad máxima", () => {
    expect(
      verifyMpSignature({
        signatureHeader: header,
        requestId: "req-1",
        dataId: "123456",
        secret,
        maxAgeSeconds: 300,
        nowMs: (Number(ts) + 3600) * 1000,
      }),
    ).toBe(false);
  });
});
