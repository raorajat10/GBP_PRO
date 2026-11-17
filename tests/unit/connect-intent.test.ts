import { describe, expect, it } from "vitest";
import {
  decodeIntent,
  encodeIntent,
  isIntentValid,
  type ConnectIntent,
} from "@/lib/gbp/connect-intent";

const CLIENT = "0b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a4b";
const base: ConnectIntent = {
  nonce: "n0nce-n0nce-n0nce-1234",
  mode: "owner",
  clientId: CLIENT,
  userId: "user-1",
  createdAt: 1_000_000,
};

describe("connect intent (CSRF protection for Connect Google)", () => {
  it("round-trips through the cookie encoding", () => {
    expect(decodeIntent(encodeIntent(base))).toEqual(base);
  });

  it("rejects garbage and tampered cookies", () => {
    expect(decodeIntent("not-base64-json")).toBeNull();
    expect(decodeIntent(encodeIntent({ ...base, clientId: "nope" } as ConnectIntent))).toBeNull();
    expect(decodeIntent(null)).toBeNull();
  });

  it("accepts only the matching state, same user, within 10 minutes", () => {
    const now = base.createdAt + 60_000;
    expect(isIntentValid(base, base.nonce, "user-1", now)).toBe(true);
    expect(isIntentValid(base, "other-state", "user-1", now)).toBe(false);
    expect(isIntentValid(base, base.nonce, "user-2", now)).toBe(false);
    expect(isIntentValid(base, base.nonce, "user-1", base.createdAt + 11 * 60_000)).toBe(false);
    expect(isIntentValid(base, null, "user-1", now)).toBe(false);
    expect(isIntentValid(null, base.nonce, "user-1", now)).toBe(false);
  });

  it("rejects mismatched mode and client (agency must have no client, owner must have one)", () => {
    const now = base.createdAt + 1000;
    expect(isIntentValid({ ...base, mode: "agency" }, base.nonce, "user-1", now)).toBe(false);
    expect(isIntentValid({ ...base, clientId: null }, base.nonce, "user-1", now)).toBe(false);
  });
});
