import Link from "next/link";
import { Suspense } from "react";
import { brand } from "@/config/brand";
import { getCurrentUser } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";

/** Static header shell; the user-specific part streams in behind Suspense. */
export function AppHeader() {
  return (
    <header className="border-line bg-surface border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 sm:px-8">
        <Link href="/dashboard" className="text-primary text-lg font-bold">
          {brand.name}
        </Link>
        <Suspense fallback={<div className="ml-auto h-8 w-40" />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isTeam = user.role === "admin" || user.role === "manager";

  return (
    <>
      {isTeam && (
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/dashboard" className="hover:text-primary">
            Clients
          </Link>
          {user.role === "admin" && (
            <Link href="/team" className="hover:text-primary">
              Team
            </Link>
          )}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="text-ink-muted hidden sm:inline">
          {user.fullName ?? user.email}
          {user.role && (
            <span className="bg-primary-soft text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-semibold capitalize">
              {user.role}
            </span>
          )}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="border-line hover:bg-paper rounded-lg border px-3 py-1.5"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
