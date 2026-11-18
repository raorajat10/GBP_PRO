import { serverEnv } from "@/lib/env";
import { MetaCloudWhatsApp } from "./meta-cloud";
import { MessagingError, type MessagingProvider } from "./types";

/** Sample mode: nothing leaves the app. The approvals service logs every message it "sends". */
export class MockMessaging implements MessagingProvider {
  readonly kind = "mock" as const;
  private id = () => ({ providerMessageId: `mock-${crypto.randomUUID()}` });
  async sendApprovalRequest() {
    return this.id();
  }
  async sendApprovalReminder() {
    return this.id();
  }
  async sendText() {
    return this.id();
  }
}

let cached: MessagingProvider | undefined;

export function getMessagingProvider(): MessagingProvider {
  if (cached) return cached;
  const env = serverEnv();
  if (env.MESSAGING_PROVIDER === "mock") {
    cached = new MockMessaging();
    return cached;
  }
  if (!env.META_WA_ACCESS_TOKEN || !env.META_WA_PHONE_NUMBER_ID) {
    throw new MessagingError(
      "WhatsApp isn't set up: add META_WA_ACCESS_TOKEN and META_WA_PHONE_NUMBER_ID.",
      "not_configured",
    );
  }
  cached = new MetaCloudWhatsApp({
    accessToken: env.META_WA_ACCESS_TOKEN,
    phoneNumberId: env.META_WA_PHONE_NUMBER_ID,
    graphVersion: env.META_GRAPH_VERSION,
    templates: { approval: env.WA_TEMPLATE_APPROVAL, reminder: env.WA_TEMPLATE_REMINDER },
  });
  return cached;
}
