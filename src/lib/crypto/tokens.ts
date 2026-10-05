import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM para los tokens de Mercado Pago.
// Formato: v1.<iv>.<tag>.<ciphertext> (base64url). El AAD ata el ciphertext a
// un contexto (el studio_id): un token copiado a otro estudio no descifra.

const VERSION = "v1";
const IV_BYTES = 12;

export function encryptWithKey(plaintext: string, key: Buffer, aad: string): string {
  if (key.length !== 32) throw new Error("La clave de encriptado tiene que tener 32 bytes");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptWithKey(payload: string, key: Buffer, aad: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error("Formato de token encriptado inválido");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

async function envKey(): Promise<Buffer> {
  const { serverEnv } = await import("@/lib/env.server");
  return Buffer.from(serverEnv().TOKEN_ENCRYPTION_KEY, "base64");
}

/** Encripta un token de MP para guardarlo en mp_connections. */
export async function encryptToken(plaintext: string, studioId: string): Promise<string> {
  return encryptWithKey(plaintext, await envKey(), `studio:${studioId}`);
}

export async function decryptToken(payload: string, studioId: string): Promise<string> {
  return decryptWithKey(payload, await envKey(), `studio:${studioId}`);
}
