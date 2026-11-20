import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { exchangeGoogleCode, GBP_SCOPE, GoogleApiError, listGoogleBusinessAccounts } from "./oauth";

/**
 * "Test Google connection" (Settings, admins only): real Google sign-in, then one call to
 * list business accounts, to show whether Google has approved API access yet. Tokens are
 * used once and thrown away — nothing is stored.
 */

export const TEST_RESULT_COOKIE = "google_test_result";

const resultSchema = z.object({
  at: z.number(),
  outcome: z.enum([
    "approved",
    "not_approved",
    "api_disabled",
    "no_permission",
    "missing_scope",
    "cancelled",
    "error",
  ]),
  email: z.string().nullable(),
  message: z.string(),
  accounts: z.number().optional(),
  locations: z.array(z.string()).optional(),
});
export type TestResult = z.infer<typeof resultSchema>;

export function googleOAuthConfig() {
  const env = serverEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

export async function runConnectionTest(code: string, appUrl: string): Promise<TestResult> {
  const cfg = googleOAuthConfig();
  if (!cfg) {
    return {
      at: Date.now(),
      outcome: "error",
      email: null,
      message: "Google client isn't set up.",
    };
  }
  let email: string | null = null;
  try {
    const tokens = await exchangeGoogleCode(cfg, { code, appUrl });
    email = tokens.email;
    if (!tokens.grantedScopes.includes(GBP_SCOPE)) {
      return {
        at: Date.now(),
        outcome: "missing_scope",
        email,
        message:
          "You signed in, but the Business Profile permission wasn't granted. Try again and tick the permission on Google's screen.",
      };
    }
    const accounts = await listGoogleBusinessAccounts(tokens.accessToken);
    const locations = accounts.flatMap((a) => a.locations.map((l) => l.title));
    return {
      at: Date.now(),
      outcome: "approved",
      email,
      accounts: accounts.length,
      locations: locations.slice(0, 20),
      message: `Google API access works. Found ${accounts.length} account(s) and ${locations.length} business location(s).`,
    };
  } catch (e) {
    if (e instanceof GoogleApiError) {
      const outcome =
        e.kind === "not_approved" || e.kind === "api_disabled" || e.kind === "no_permission"
          ? e.kind
          : "error";
      return { at: Date.now(), outcome, email, message: e.message };
    }
    return {
      at: Date.now(),
      outcome: "error",
      email,
      message: "Couldn't reach Google. Try again.",
    };
  }
}

export async function saveTestResult(result: TestResult, secure: boolean) {
  (await cookies()).set(
    TEST_RESULT_COOKIE,
    Buffer.from(JSON.stringify(result)).toString("base64url"),
    {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/settings",
      maxAge: 600,
    },
  );
}

export async function readTestResult(): Promise<TestResult | null> {
  const raw = (await cookies()).get(TEST_RESULT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = resultSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
