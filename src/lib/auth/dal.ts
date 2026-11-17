import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homePathForRole, type AppRole } from "./paths";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole | null;
}

/**
 * The one place that reads the session (Data Access Layer). Reads cookies, so callers
 * must sit inside a <Suspense> boundary. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
});

/** Use at the top of every protected page and server action. Redirects if not allowed. */
export async function requireUser(allowed?: readonly AppRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (allowed && (!user.role || !allowed.includes(user.role))) {
    redirect(homePathForRole(user.role));
  }
  return user;
}
