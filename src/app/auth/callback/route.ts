import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/paths";

/**
 * Handles the link in the sign-in email (when the email template sends a link
 * instead of, or as well as, the 6-digit code).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const next = safeNextPath(searchParams.get("next"));

  // Google sign-in refused (e.g. this Google account wasn't invited).
  if (searchParams.get("error"))
    return NextResponse.redirect(new URL("/login?error=google", origin));

  const supabase = await createSupabaseServerClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })).error;
  }

  if (!ok) return NextResponse.redirect(new URL("/login?error=link", origin));
  // /dashboard sends client users on to /home, so this is a safe default for everyone.
  return NextResponse.redirect(new URL(next ?? "/dashboard", origin));
}
