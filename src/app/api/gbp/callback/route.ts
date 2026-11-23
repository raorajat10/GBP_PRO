import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { CONNECT_COOKIE, decodeIntent, isIntentValid } from "@/lib/gbp/connect-intent";
import { runConnectionTest, saveTestResult } from "@/lib/gbp/google/test-connection";
import { claimInvite, recordInviteConnection } from "@/lib/gbp/invites";
import { getGbpProvider } from "@/lib/gbp/provider";
import { canManageClient, linkLocation, saveConnection } from "@/lib/gbp/service";
import { serverEnv } from "@/lib/env";

/** Google (or the sample consent page) sends the user back here after "Connect Google". */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const jar = await cookies();
  const intent = decodeIntent(jar.get(CONNECT_COOKIE)?.value);
  jar.delete(CONNECT_COOKIE);

  // ── Owner invite: no team login; the invite (checked again below) is the permission. ──
  if (intent?.inviteId) {
    const done = (status: string) =>
      NextResponse.redirect(new URL(`/invite/done?status=${status}`, origin));
    if (!isIntentValid(intent, searchParams.get("state"), null)) return done("expired");
    if (searchParams.get("error")) return done("cancelled");
    const code = searchParams.get("code");
    if (!code) return done("error");
    try {
      const kind = serverEnv().GBP_PROVIDER;
      const provider = getGbpProvider(kind);
      const account = await provider.exchangeCode({ code, mode: "owner", appUrl: origin });
      // Use up the invite only once Google has said yes; a cancel can be retried.
      const claimed = await claimInvite(intent.inviteId);
      if (!claimed || claimed.clientId !== intent.clientId) return done("used");
      const conn = await saveConnection({
        provider: kind,
        mode: "owner",
        clientId: claimed.clientId,
        accountName: account.accountName,
        label: account.label,
        userId: null,
        refreshToken: account.refreshToken,
      });
      await recordInviteConnection(intent.inviteId, conn.id);
      const locations = await provider.listLocations({
        accountName: account.accountName,
        refreshToken: account.refreshToken,
      });
      if (locations.length === 1) {
        await linkLocation({
          clientId: claimed.clientId,
          connectionId: conn.id,
          locationName: locations[0].name,
        });
        return done("linked");
      }
      // Several profiles: the team picks the right one on the client page.
      return done(locations.length ? "connected" : "no-profiles");
    } catch {
      return done("error");
    }
  }

  // ── Team member connecting (agency account, or owner sitting with them). ──
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!isIntentValid(intent, searchParams.get("state"), user.id)) {
    return NextResponse.redirect(new URL("/dashboard?gbp=expired", origin));
  }
  // ── Admin's "Test Google connection": real Google, nothing saved. ──
  if (intent.purpose === "test") {
    if (user.role !== "admin")
      return NextResponse.redirect(new URL("/dashboard?gbp=forbidden", origin));
    const code = searchParams.get("code");
    const result =
      searchParams.get("error") || !code
        ? {
            at: Date.now(),
            outcome: "cancelled" as const,
            email: null,
            message: "Google sign-in was cancelled. Nothing was changed.",
          }
        : await runConnectionTest(code, origin);
    await saveTestResult(result, origin.startsWith("https://"));
    return NextResponse.redirect(new URL("/settings?gbp=tested", origin));
  }

  const target = intent.mode === "agency" ? "/settings" : `/clients/${intent.clientId}`;
  const back = (status: string) =>
    NextResponse.redirect(new URL(`${target}?gbp=${status}`, origin));

  if (searchParams.get("error")) return back("cancelled");
  const code = searchParams.get("code");
  if (!code) return back("error");

  // Permissions may have changed while the user was away — check again.
  const allowed =
    intent.mode === "agency"
      ? user.role === "admin"
      : await canManageClient(intent.clientId!, user.role);
  if (!allowed) return back("forbidden");

  try {
    const kind = serverEnv().GBP_PROVIDER;
    const provider = getGbpProvider(kind);
    const account = await provider.exchangeCode({ code, mode: intent.mode, appUrl: origin });
    const conn = await saveConnection({
      provider: kind,
      mode: intent.mode,
      clientId: intent.clientId,
      accountName: account.accountName,
      label: account.label,
      userId: user.id,
      refreshToken: account.refreshToken,
    });

    if (intent.mode === "owner") {
      // An owner usually has one profile — link it straight away.
      const locations = await provider.listLocations({
        accountName: account.accountName,
        refreshToken: account.refreshToken,
      });
      if (locations.length === 1) {
        await linkLocation({
          clientId: intent.clientId!,
          connectionId: conn.id,
          locationName: locations[0].name,
        });
        return back("linked");
      }
      return back(locations.length ? "choose" : "no-profiles");
    }
    return back("connected");
  } catch {
    return back("error");
  }
}
