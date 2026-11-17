import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { CONNECT_COOKIE, decodeIntent, isIntentValid } from "@/lib/gbp/connect-intent";
import { getGbpProvider } from "@/lib/gbp/provider";
import { canManageClient, linkLocation, saveConnection } from "@/lib/gbp/service";
import { serverEnv } from "@/lib/env";

/** Google (or the sample consent page) sends the user back here after "Connect Google". */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const jar = await cookies();
  const intent = decodeIntent(jar.get(CONNECT_COOKIE)?.value);
  jar.delete(CONNECT_COOKIE);

  if (!isIntentValid(intent, searchParams.get("state"), user.id)) {
    return NextResponse.redirect(new URL("/dashboard?gbp=expired", origin));
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
