import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { CONNECT_COOKIE, encodeIntent, INTENT_MAX_AGE_SECONDS } from "@/lib/gbp/connect-intent";
import { getGbpProvider } from "@/lib/gbp/provider";
import { canManageClient } from "@/lib/gbp/service";
import { GbpError } from "@/lib/gbp/types";
import { serverEnv } from "@/lib/env";

/**
 * Start "Connect Google":
 *   ?mode=agency               → admin connects the team's Google account
 *   ?mode=owner&clientId=…     → connect an owner's own Google account for one client
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const mode = searchParams.get("mode");
  const clientId = searchParams.get("clientId");
  const back = (path: string, status: string) =>
    NextResponse.redirect(new URL(`${path}?gbp=${status}`, origin));

  if (mode === "agency") {
    if (user.role !== "admin") return back("/dashboard", "forbidden");
  } else if (mode === "owner") {
    if (!z.uuid().safeParse(clientId).success || !(await canManageClient(clientId!, user.role))) {
      return back("/dashboard", "forbidden");
    }
  } else {
    return back("/dashboard", "error");
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  (await cookies()).set(
    CONNECT_COOKIE,
    encodeIntent({
      nonce,
      mode,
      clientId: mode === "owner" ? clientId : null,
      userId: user.id,
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
    return NextResponse.redirect(provider.authorizationUrl({ state: nonce, mode, appUrl: origin }));
  } catch (e) {
    const target = mode === "agency" ? "/settings" : `/clients/${clientId}`;
    return back(
      target,
      e instanceof GbpError && e.kind === "not_enabled" ? "not-enabled" : "error",
    );
  }
}
