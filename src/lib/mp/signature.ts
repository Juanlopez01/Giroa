import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida el header x-signature de un webhook de Mercado Pago.
 *   x-signature: "ts=1704908010,v1=<hmac hex>"
 *   manifest:    "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * (se omiten las partes que no vienen). HMAC-SHA256 con la clave secreta de
 * webhooks de la aplicación. data.id alfanumérico va en minúsculas.
 */
export function verifyMpSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  /** Tolerancia de antigüedad en segundos (0 = no chequear). */
  maxAgeSeconds?: number;
  nowMs?: number;
}): boolean {
  const { signatureHeader, requestId, dataId, secret, maxAgeSeconds = 0, nowMs = Date.now() } = params;
  if (!signatureHeader) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s?.trim());
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !v1 || !/^[a-f0-9]+$/i.test(v1)) return false;

  if (maxAgeSeconds > 0) {
    const tsMs = Number(ts) * (ts.length > 10 ? 1 : 1000);
    if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > maxAgeSeconds * 1000) return false;
  }

  const id = dataId && /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
