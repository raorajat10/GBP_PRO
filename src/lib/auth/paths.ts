/** Pure routing rules for auth — no Next/Supabase imports, so they're unit-testable. */

export type AppRole = "admin" | "manager" | "client";

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/clients",
  "/settings",
  "/connect",
  "/team",
  "/home",
  "/no-access",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function homePathForRole(role: AppRole | null): string {
  if (role === "admin" || role === "manager") return "/dashboard";
  if (role === "client") return "/home";
  return "/no-access";
}

/**
 * Only allow same-site relative paths after login, so `?next=` can't be used
 * to bounce someone to another website (open redirect).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
