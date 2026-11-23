import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts Google refresh tokens before they are stored (AES-256-GCM, authenticated).
 * The key lives only in the server environment (TOKEN_ENCRYPTION_KEY, 32 bytes, base64),
 * so a database leak alone doesn't hand anyone access to clients' Google profiles.
 *
 * Stored format: "v1.<iv>.<tag>.<ciphertext>", each part base64url.
 */

const VERSION = "v1";

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

export function parseKey(base64: string | undefined): Buffer {
  if (!base64) throw new TokenCryptoError("TOKEN_ENCRYPTION_KEY is not set.");
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) {
    throw new TokenCryptoError("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  }
  return key;
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decryptToken(stored: string, key: Buffer): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !data) {
    throw new TokenCryptoError("Stored token is in an unknown format.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new TokenCryptoError("Stored token couldn't be decrypted (wrong key or tampered).");
  }
}
