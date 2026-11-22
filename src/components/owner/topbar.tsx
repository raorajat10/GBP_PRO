import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getOwnerContext } from "@/lib/owner/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { BusinessSwitcher } from "./business-switcher";

/** Owner top bar: which business, unread notifications, theme, sign out. */
export async function OwnerTopbar() {
  const ctx = await getOwnerContext();
  let unread = 0;
  if (ctx.business) {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("client_id", ctx.business.id)
      .is("read_at", null);
    unread = count ?? 0;
  }

  return (
    <header className="border-line bg-surface sticky top-0 z-20 flex h-16 items-center gap-3 border-b pr-4 pl-16 sm:pr-8 lg:pl-8 print:hidden">
      {ctx.business ? (
        <BusinessSwitcher
          current={ctx.business.id}
          businesses={ctx.businesses.map((b) => ({ id: b.id, name: b.name }))}
        />
      ) : (
        <span className="text-ink-muted text-sm">No business linked yet</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/home/notifications"
          className="border-line hover:bg-paper relative flex size-9 items-center justify-center rounded-lg border"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 && (
            <span className="bg-accent text-ink absolute -top-1.5 -right-1.5 min-w-5 rounded-full px-1 text-center text-[11px] leading-5 font-bold tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <ThemeToggle />
        <span className="text-ink-muted hidden max-w-40 truncate text-sm md:inline">
          {ctx.user.fullName ?? ctx.user.email}
        </span>
        <form action={signOut} className="hidden sm:block">
          <button
            type="submit"
            className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
