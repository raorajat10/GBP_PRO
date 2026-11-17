import { z } from "zod";

/**
 * What we remember (in an httpOnly cookie) between "Connect Google" and Google's redirect
 * back. The `state` sent to Google is the nonce; the callback only accepts it if the
 * cookie matches, belongs to the same signed-in user and is recent (CSRF protection).
 */
const intentSchema = z.object({
  nonce: z.string().min(16),
  mode: z.enum(["agency", "owner"]),
  clientId: z.uuid().nullable(),
  userId: z.string().min(1),
  createdAt: z.number(),
});

export type ConnectIntent = z.infer<typeof intentSchema>;
export const CONNECT_COOKIE = "gbp_connect";
export const INTENT_MAX_AGE_SECONDS = 600;

export function encodeIntent(intent: ConnectIntent): string {
  return Buffer.from(JSON.stringify(intent)).toString("base64url");
}

export function decodeIntent(raw: string | undefined | null): ConnectIntent | null {
  if (!raw) return null;
  try {
    const parsed = intentSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isIntentValid(
  intent: ConnectIntent | null,
  state: string | null,
  userId: string,
  now: number = Date.now(),
): intent is ConnectIntent {
  return (
    intent !== null &&
    state !== null &&
    intent.nonce === state &&
    intent.userId === userId &&
    now - intent.createdAt <= INTENT_MAX_AGE_SECONDS * 1000 &&
    (intent.mode === "agency") === (intent.clientId === null)
  );
}
