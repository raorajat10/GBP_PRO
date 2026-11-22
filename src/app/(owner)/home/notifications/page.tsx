import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { Empty, fmtDateTime, NoBusiness, PageHeader, Panel, Pill } from "@/components/owner/ui";
import { markAllRead, openNotification } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

const KIND_LABEL: Record<string, string> = {
  review: "Reviews",
  approval: "Approvals",
  score: "Score",
  ticket: "Support",
  report: "Reports",
  feedback: "Feedback",
  general: "News",
};

export default function NotificationsPage({ searchParams }: PageProps<"/home/notifications">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Notifications" />
          <ListSkeleton rows={4} />
        </>
      }
    >
      {searchParams.then((sp) => (
        <Notifications unreadOnly={sp.show === "unread"} />
      ))}
    </Suspense>
  );
}

async function Notifications({ unreadOnly }: { unreadOnly: boolean }) {
  const { business } = await getOwnerContext();
  if (!business) {
    return (
      <>
        <PageHeader title="Notifications" />
        <NoBusiness />
      </>
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("client_id", business.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const all = data ?? [];
  const unread = all.filter((n) => !n.read_at).length;
  const shown = unreadOnly ? all.filter((n) => !n.read_at) : all;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="New reviews, posts waiting for you, feedback and replies from our team."
        actions={
          unread > 0 ? (
            <form action={markAllRead}>
              <button
                type="submit"
                className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm font-medium"
              >
                Mark all as read
              </button>
            </form>
          ) : undefined
        }
      />
      <nav aria-label="Filter notifications" className="flex gap-2 text-sm">
        {[
          { href: "/home/notifications", label: `All (${all.length})`, on: !unreadOnly },
          { href: "/home/notifications?show=unread", label: `Unread (${unread})`, on: unreadOnly },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.on ? "page" : undefined}
            className={
              f.on
                ? "bg-primary text-primary-ink rounded-full px-3 py-1 font-semibold"
                : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1"
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <Panel>
        {shown.length ? (
          <ul className="divide-line flex flex-col divide-y">
            {shown.map((n) => (
              <li key={n.id} className="py-1 first:pt-0 last:pb-0">
                <form action={openNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="hover:bg-paper flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left"
                  >
                    <span
                      className={`mt-2 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-accent"}`}
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={n.read_at ? "" : "font-semibold"}>{n.title}</span>
                        <Pill>{KIND_LABEL[n.kind] ?? "News"}</Pill>
                        {!n.read_at && <span className="sr-only">(unread)</span>}
                      </span>
                      {n.body && <span className="text-ink-muted text-sm">{n.body}</span>}
                      <span className="text-ink-muted text-xs">{fmtDateTime(n.created_at)}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{unreadOnly ? "You're all caught up." : "No notifications yet."}</Empty>
        )}
      </Panel>
    </>
  );
}
