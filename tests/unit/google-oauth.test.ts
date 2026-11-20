import { describe, expect, it } from "vitest";
import {
  classifyGoogleError,
  exchangeGoogleCode,
  GBP_SCOPE,
  googleAuthorizationUrl,
  listGoogleBusinessAccounts,
} from "@/lib/gbp/google/oauth";

const cfg = { clientId: "abc.apps.googleusercontent.com", clientSecret: "GOCSPX-test" };

describe("googleAuthorizationUrl", () => {
  it("asks for Business Profile access, offline, with our exact callback and the state", () => {
    const u = new URL(
      googleAuthorizationUrl(cfg, { state: "nonce123", appUrl: "https://gbppro-pi.vercel.app" }),
    );
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = u.searchParams;
    expect(p.get("client_id")).toBe(cfg.clientId);
    expect(p.get("redirect_uri")).toBe("https://gbppro-pi.vercel.app/api/gbp/callback");
    expect(p.get("scope")?.split(" ")).toContain(GBP_SCOPE);
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("state")).toBe("nonce123");
    expect(u.toString()).not.toContain(cfg.clientSecret); // the secret never goes to the browser
  });
});

const idToken = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;

describe("exchangeGoogleCode", () => {
  it("returns the tokens, email and granted scopes", async () => {
    let sent: URLSearchParams | undefined;
    const fake = (async (_url: string, init: RequestInit) => {
      sent = init.body as URLSearchParams;
      return Response.json({
        access_token: "at",
        refresh_token: "rt",
        id_token: idToken({ email: "owner@example.com" }),
        scope: `openid email ${GBP_SCOPE}`,
      });
    }) as unknown as typeof fetch;
    const t = await exchangeGoogleCode(
      cfg,
      { code: "c0de", appUrl: "http://localhost:3000" },
      fake,
    );
    expect(t).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      email: "owner@example.com",
      grantedScopes: ["openid", "email", GBP_SCOPE],
    });
    expect(sent?.get("redirect_uri")).toBe("http://localhost:3000/api/gbp/callback");
    expect(sent?.get("grant_type")).toBe("authorization_code");
  });

  it("explains a failed sign-in", async () => {
    const fake = (async () =>
      Response.json(
        { error: "invalid_grant", error_description: "Bad Request" },
        { status: 400 },
      )) as unknown as typeof fetch;
    await expect(exchangeGoogleCode(cfg, { code: "x", appUrl: "http://x" }, fake)).rejects.toThrow(
      /Bad Request/,
    );
  });
});

describe("classifyGoogleError", () => {
  it("quota 0 means Google hasn't approved API access yet", () => {
    expect(
      classifyGoogleError(429, {
        error: { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" },
      }).kind,
    ).toBe("not_approved");
  });
  it("recognises APIs that aren't enabled in the project", () => {
    expect(
      classifyGoogleError(403, {
        error: {
          status: "PERMISSION_DENIED",
          message:
            "My Business Account Management API has not been used in project 123 before or it is disabled.",
          details: [{ reason: "SERVICE_DISABLED" }],
        },
      }).kind,
    ).toBe("api_disabled");
  });
  it("other 403s and 401s", () => {
    expect(
      classifyGoogleError(403, { error: { status: "PERMISSION_DENIED", message: "nope" } }).kind,
    ).toBe("no_permission");
    expect(classifyGoogleError(401, {}).kind).toBe("auth");
    expect(classifyGoogleError(500, {}).kind).toBe("unknown");
  });
});

describe("listGoogleBusinessAccounts", () => {
  it("lists accounts and their locations", async () => {
    const fake = (async (url: string) =>
      url.includes("/locations")
        ? Response.json({ locations: [{ name: "locations/1", title: "Sarvatra Energy" }] })
        : Response.json({
            accounts: [
              { name: "accounts/9", accountName: "Rajasthan Battery House", type: "PERSONAL" },
            ],
          })) as unknown as typeof fetch;
    expect(await listGoogleBusinessAccounts("at", fake)).toEqual([
      {
        name: "accounts/9",
        accountName: "Rajasthan Battery House",
        type: "PERSONAL",
        locations: [{ name: "locations/1", title: "Sarvatra Energy" }],
      },
    ]);
  });
  it("reports 'not approved' when Google's quota is 0", async () => {
    const fake = (async () =>
      Response.json(
        { error: { status: "RESOURCE_EXHAUSTED", message: "Quota" } },
        { status: 429 },
      )) as unknown as typeof fetch;
    await expect(listGoogleBusinessAccounts("at", fake)).rejects.toMatchObject({
      kind: "not_approved",
    });
  });
});
