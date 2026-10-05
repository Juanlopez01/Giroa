import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Payload firmado con HMAC-SHA256 y vencimiento: <payload>.<firma> en base64url.
// Se usa para el state del OAuth de Mercado Pago (nadie puede vincular una
// cuenta a un estudio ajeno ni reusar un state viejo).

type Signed<T> = T & { exp: number; nonce: string };

function hmac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signPayload<T extends object>(payload: T, secret: string, ttlSeconds: number, now = Date.now()): string {
  const body: Signed<T> = {
    ...payload,
    exp: Math.floor(now / 1000) + ttlSeconds,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${encoded}.${hmac(encoded, secret).toString("base64url")}`;
}

/** Devuelve el payload si la firma es válida y no venció; si no, null. */
export function verifyPayload<T extends object>(token: string, secret: string, now = Date.now()): Signed<T> | null {
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) return null;

  const expected = hmac(encoded, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let body: unknown;
  try {
    body = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;

  const exp = (body as { exp?: unknown }).exp;
  if (typeof exp !== "number" || exp < Math.floor(now / 1000)) return null;

  return body as Signed<T>;
}
