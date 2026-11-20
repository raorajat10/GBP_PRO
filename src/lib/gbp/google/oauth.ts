/**
 * Google OAuth and the first Business Profile calls (official endpoints only).
 * Pure request/response handling — no database, no Next.js — so it is unit-testable.
 */

export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO_URL = "https://mybusinessbusinessinformation.googleapis.com/v1";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/** Must match an "Authorised redirect URI" on the OAuth client exactly. */
export const callbackUrl = (appUrl: string) => new URL("/api/gbp/callback", appUrl).toString();

export function googleAuthorizationUrl(
  cfg: Pick<GoogleOAuthConfig, "clientId">,
  input: { state: string; appUrl: string; loginHint?: string },
): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl(input.appUrl),
    response_type: "code",
    scope: `openid email ${GBP_SCOPE}`,
    access_type: "offline", // a refresh token, so we can act later without the owner present
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
    ...(input.loginHint ? { login_hint: input.loginHint } : {}),
  }).toString();
  return url.toString();
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  email: string | null;
  grantedScopes: string[];
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly kind: "not_approved" | "api_disabled" | "no_permission" | "auth" | "unknown",
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

/** The id_token comes straight from Google's token endpoint over TLS; we only read the email. */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(
  cfg: GoogleOAuthConfig,
  input: { code: string; appUrl: string },
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleTokens> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: callbackUrl(input.appUrl),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new GoogleApiError(
      `Google sign-in failed: ${data.error_description ?? data.error ?? res.status}`,
      "auth",
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    email: emailFromIdToken(data.id_token),
    grantedScopes: (data.scope ?? "").split(" ").filter(Boolean),
  };
}

/**
 * Turn a Google API error into something a person can act on. Before Google approves
 * Business Profile API access, the project's quota is 0 and calls fail with 429.
 */
export function classifyGoogleError(status: number, body: unknown): GoogleApiError {
  const err = (body as { error?: { status?: string; message?: string; details?: unknown[] } })
    ?.error;
  const reason = JSON.stringify(err?.details ?? "");
  const message = err?.message ?? `HTTP ${status}`;
  if (status === 429 || err?.status === "RESOURCE_EXHAUSTED") {
    return new GoogleApiError(
      "Google hasn't approved Business Profile API access for this project yet (quota is 0).",
      "not_approved",
    );
  }
  if (
    err?.status === "PERMISSION_DENIED" &&
    /SERVICE_DISABLED|has not been used|is disabled/i.test(`${reason} ${message}`)
  ) {
    return new GoogleApiError(
      "The Business Profile APIs aren't enabled in this Google Cloud project yet. Enable them once access is approved.",
      "api_disabled",
    );
  }
  if (status === 403) {
    return new GoogleApiError(`Google refused access: ${message}`, "no_permission");
  }
  if (status === 401) return new GoogleApiError("Google sign-in expired. Try again.", "auth");
  return new GoogleApiError(`Google returned an error: ${message}`, "unknown");
}

async function getJson(url: string, accessToken: string, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw classifyGoogleError(res.status, body);
  return body;
}

export interface GoogleAccountSummary {
  name: string; // accounts/123
  accountName: string;
  type: string;
  locations: { name: string; title: string }[];
}

/** Business accounts the signed-in user can manage, with their locations. */
export async function listGoogleBusinessAccounts(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleAccountSummary[]> {
  const { accounts = [] } = (await getJson(ACCOUNTS_URL, accessToken, fetchImpl)) as {
    accounts?: { name: string; accountName?: string; type?: string }[];
  };
  const out: GoogleAccountSummary[] = [];
  for (const a of accounts.slice(0, 10)) {
    const { locations = [] } = (await getJson(
      `${INFO_URL}/${a.name}/locations?readMask=name,title&pageSize=100`,
      accessToken,
      fetchImpl,
    )) as { locations?: { name: string; title?: string }[] };
    out.push({
      name: a.name,
      accountName: a.accountName ?? a.name,
      type: a.type ?? "",
      locations: locations.map((l) => ({ name: l.name, title: l.title ?? l.name })),
    });
  }
  return out;
}
