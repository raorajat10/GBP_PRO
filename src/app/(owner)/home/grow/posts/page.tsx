import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { listPosts } from "@/lib/posts/service";
import { ListSkeleton } from "@/components/skeleton";
import { PostStatusChip } from "@/components/post-status-chip";
import { Empty, fmtDate, NoBusiness, nf, PageHeader, Panel } from "@/components/owner/ui";

export const metadata: Metadata = { title: "Posts" };

const FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "live", label: "Live", statuses: ["published"] },
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled", "publishing"] },
  { key: "waiting", label: "Waiting for you", statuses: ["pending_approval"] },
  {
    key: "other",
    label: "Changes and expired",
    statuses: ["changes_requested", "expired", "failed"],
  },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default function PostsPage({ searchParams }: PageProps<"/home/grow/posts">) {
  return (
    <>
      <PageHeader
        title="Posts"
        description="Updates our team writes for your Google profile. Nothing goes live until you approve it."
        actions={
          <Link
            href="/home/grow/post-bank"
            className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold"
          >
            Send photos for posts
          </Link>
        }
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        {searchParams.then((sp) => {
          const f = FILTERS.find((x) => x.key === sp.show)?.key ?? "all";
          return <Posts filter={f} />;
        })}
      </Suspense>
    </>
  );
}

async function Posts({ filter }: { filter: FilterKey }) {
  const { business } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  // Row-level security hides drafts from owners.
  const posts = (await listPosts(business.id)).filter((p) => p.status !== "draft");
  const count = (f: (typeof FILTERS)[number]) =>
    f.statuses
      ? posts.filter((p) => (f.statuses as readonly string[]).includes(p.status)).length
      : posts.length;
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = active.statuses
    ? posts.filter((p) => (active.statuses as readonly string[]).includes(p.status))
    : posts;

  return (
    <>
      <nav aria-label="Filter posts" className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/home/grow/posts" : `/home/grow/posts?show=${f.key}`}
            aria-current={f.key === filter ? "page" : undefined}
            className={
              f.key === filter
                ? "bg-primary text-primary-ink rounded-full px-3 py-1 font-semibold"
                : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1"
            }
          >
            {f.label} <span className="tabular-nums opacity-80">{nf.format(count(f))}</span>
          </Link>
        ))}
      </nav>

      {shown.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <li
              key={p.id}
              className="border-line bg-surface flex flex-col overflow-hidden rounded-2xl border"
            >
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="bg-primary-soft text-primary flex aspect-[4/3] items-center justify-center text-sm font-medium">
                  Text-only post
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PostStatusChip status={p.status} />
                  <span className="text-ink-muted text-xs">
                    {p.scheduledFor ? `For ${fmtDate(p.scheduledFor)}` : fmtDate(p.createdAt)}
                  </span>
                </div>
                <p className="line-clamp-4 text-sm leading-relaxed">{p.body}</p>
                {p.status === "pending_approval" && (
                  <p className="text-ink-muted mt-auto text-xs">
                    Approve it from the WhatsApp message or link our team sent you.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Panel>
          <Empty>
            {posts.length
              ? "No posts here."
              : "No posts yet. Send us photos of your work and our team will turn them into posts."}
          </Empty>
        </Panel>
      )}
    </>
  );
}
