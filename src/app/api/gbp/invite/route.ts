import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { CONNECT_COOKIE, encodeIntent, INTENT_MAX_AGE_SECONDS } from "@/lib/gbp/connect-intent";
import { getInviteByToken } from "@/lib/gbp/invites";
import { getGbpProvider } from "@/lib/gbp/provider";

/**
 * The owner clicked "Continue with Google" on their invite page. No login: the invite
 * token is the permission. We remember the invite in a short-lived cookie and send them
 * to Google's consent screen (or the sample one until Google approves our API access).
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const token = searchParams.get("token") ?? "";
  const done = (status: string) =>
    NextResponse.redirect(new URL(`/invite/done?status=${status}`, origin));

  const invite = await getInviteByToken(token);
  if (!invite) return done("invalid");
  if (invite.status !== "pending") {
    return done(invite.status === "cancelled" ? "cancelled_invite" : invite.status);
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  (await cookies()).set(
    CONNECT_COOKIE,
    encodeIntent({
      nonce,
      mode: "owner",
      clientId: invite.clientId,
      userId: null,
      inviteId: invite.id,
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

  try {
    const provider = getGbpProvider(serverEnv().GBP_PROVIDER);
    if (provider.kind === "mock") {
      return NextResponse.redirect(new URL(`/invite/sample?state=${nonce}`, origin));
    }
    return NextResponse.redirect(
      provider.authorizationUrl({ state: nonce, mode: "owner", appUrl: origin }),
    );
  } catch {
    return done("error");
  }
}
