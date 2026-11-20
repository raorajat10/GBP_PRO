import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { CONNECT_COOKIE, encodeIntent, INTENT_MAX_AGE_SECONDS } from "@/lib/gbp/connect-intent";
import { googleAuthorizationUrl } from "@/lib/gbp/google/oauth";
import { googleOAuthConfig } from "@/lib/gbp/google/test-connection";

/** Admin starts "Test Google connection": off to Google's real consent screen. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (user.role !== "admin")
    return NextResponse.redirect(new URL("/dashboard?gbp=forbidden", origin));
  const cfg = googleOAuthConfig();
  if (!cfg) return NextResponse.redirect(new URL("/settings?gbp=error", origin));

  const nonce = crypto.randomUUID().replace(/-/g, "");
  (await cookies()).set(
    CONNECT_COOKIE,
    encodeIntent({
      nonce,
      mode: "agency",
      clientId: null,
      userId: user.id,
      purpose: "test",
      createdAt: Date.now(),
    }),
    {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: INTENT_MAX_AGE_SECONDS,
    },
  );
  return NextResponse.redirect(googleAuthorizationUrl(cfg, { state: nonce, appUrl: origin }));
}
