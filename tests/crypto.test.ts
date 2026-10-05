import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptWithKey, encryptWithKey } from "@/lib/crypto/tokens";
import { signPayload, verifyPayload } from "@/lib/crypto/signing";

describe("encriptado de tokens (AES-256-GCM)", () => {
  const key = randomBytes(32);
  const aad = "studio:11111111-1111-1111-1111-111111111111";

  it("ida y vuelta", () => {
    const enc = encryptWithKey("APP_USR-secreto", key, aad);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("APP_USR-secreto");
    expect(decryptWithKey(enc, key, aad)).toBe("APP_USR-secreto");
  });

  it("cada encriptado usa un IV distinto", () => {
    expect(encryptWithKey("x", key, aad)).not.toBe(encryptWithKey("x", key, aad));
  });

  it("falla con otra clave", () => {
    const enc = encryptWithKey("secreto", key, aad);
    expect(() => decryptWithKey(enc, randomBytes(32), aad)).toThrow();
  });

  it("falla si se copia a otro estudio (AAD distinto)", () => {
    const enc = encryptWithKey("secreto", key, aad);
    expect(() => decryptWithKey(enc, key, "studio:otro")).toThrow();
  });

  it("falla si se altera el ciphertext", () => {
    const enc = encryptWithKey("secreto", key, aad);
    const parts = enc.split(".");
    const ct = Buffer.from(parts[3]!, "base64url");
    ct[0] = ct[0]! ^ 1;
    parts[3] = ct.toString("base64url");
    expect(() => decryptWithKey(parts.join("."), key, aad)).toThrow();
  });

  it("rechaza claves que no son de 32 bytes", () => {
    expect(() => encryptWithKey("x", randomBytes(16), aad)).toThrow();
  });
});

describe("payload firmado (state del OAuth)", () => {
  const secret = "s".repeat(40);
  const now = Date.UTC(2026, 9, 5, 12, 0, 0);

  it("verifica un payload válido", () => {
    const token = signPayload({ studioId: "abc", userId: "u1" }, secret, 600, now);
    const body = verifyPayload<{ studioId: string; userId: string }>(token, secret, now);
    expect(body?.studioId).toBe("abc");
    expect(body?.userId).toBe("u1");
  });

  it("rechaza si cambió el contenido", () => {
    const token = signPayload({ studioId: "abc" }, secret, 600, now);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ studioId: "otro", exp: 9999999999, nonce: "n" })).toString("base64url");
    expect(verifyPayload(`${forged}.${sig}`, secret, now)).toBeNull();
  });

  it("rechaza con otro secreto", () => {
    const token = signPayload({ studioId: "abc" }, secret, 600, now);
    expect(verifyPayload(token, "otro".repeat(10), now)).toBeNull();
  });

  it("rechaza si venció", () => {
    const token = signPayload({ studioId: "abc" }, secret, 600, now);
    expect(verifyPayload(token, secret, now + 601_000)).toBeNull();
  });

  it("rechaza basura", () => {
    expect(verifyPayload("", secret, now)).toBeNull();
    expect(verifyPayload("a.b.c", secret, now)).toBeNull();
    expect(verifyPayload("no-tiene-punto", secret, now)).toBeNull();
  });
});
