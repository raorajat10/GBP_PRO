import { timingSafeEqual } from "node:crypto";
import { handleInboundEvents } from "@/lib/approvals/service";
import { serverEnv } from "@/lib/env";
import { parseMetaWebhook, verifyMetaSignature } from "@/lib/messaging/meta-cloud";

/**
 * Meta WhatsApp Cloud API webhook (docs/PLAN.md §6.2 step 4).
 * Callback URL: <APP_URL>/api/webhooks/whatsapp, verify token: META_WEBHOOK_VERIFY_TOKEN.
 */

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Meta's one-time subscription check. */
export async function GET(request: Request) {
  const env = serverEnv();
  const p = new URL(request.url).searchParams;
  const token = p.get("hub.verify_token") ?? "";
  if (
    p.get("hub.mode") === "subscribe" &&
    env.META_WEBHOOK_VERIFY_TOKEN &&
    safeEqual(token, env.META_WEBHOOK_VERIFY_TOKEN)
  ) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.META_APP_SECRET || !env.META_WA_PHONE_NUMBER_ID) {
    return new Response("WhatsApp isn't configured", { status: 503 });
  }
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), env.META_APP_SECRET)) {
    return new Response("Bad signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  await handleInboundEvents(parseMetaWebhook(body, env.META_WA_PHONE_NUMBER_ID));
  // Always 200 once verified, or Meta keeps retrying the same events.
  return new Response("OK", { status: 200 });
}
