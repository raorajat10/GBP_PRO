import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Transactional email through Resend (the same service that sends login emails).
 * Needs RESEND_API_KEY and EMAIL_FROM (an address on the verified domain, e.g.
 * "GBP Pro <connect@sarvatraenergy.com>"). Without them, callers fall back to a link.
 */
export const emailEnabled = () => {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
};

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

export async function sendEmail(
  msg: { to: string; subject: string; text: string; html: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new EmailError("Email isn't set up.");
  let res: Response;
  try {
    res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...msg, from: env.EMAIL_FROM, to: [msg.to] }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new EmailError("Couldn't reach the email service.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new EmailError(`The email service refused the message: ${data.message ?? res.status}`);
  }
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export { esc as escapeHtml };
