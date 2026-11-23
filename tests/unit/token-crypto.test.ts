import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, parseKey, TokenCryptoError } from "@/lib/crypto/tokens";

const key = randomBytes(32);

describe("refresh-token encryption", () => {
  it("round-trips and never stores the plain token", () => {
    const stored = encryptToken("1//refresh-token-value", key);
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain("refresh-token-value");
    expect(decryptToken(stored, key)).toBe("1//refresh-token-value");
  });

  it("uses a fresh IV every time", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("refuses the wrong key or a tampered value", () => {
    const stored = encryptToken("secret", key);
    expect(() => decryptToken(stored, randomBytes(32))).toThrow(TokenCryptoError);
    const parts = stored.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow(TokenCryptoError);
    expect(() => decryptToken("plain-text", key)).toThrow(TokenCryptoError);
  });

  it("checks the key", () => {
    expect(() => parseKey(undefined)).toThrow(/not set/);
    expect(() => parseKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
    expect(parseKey(key.toString("base64"))).toHaveLength(32);
  });
});
