import type { Metadata } from "next";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { AutoReplyForm } from "@/components/auto-reply-form";
import {
  Empty,
  fmtDate,
  NoBusiness,
  NoProfile,
  PageHeader,
  Panel,
  Stars,
} from "@/components/owner/ui";
import { saveOwnerAutoReply } from "./actions";

export const metadata: Metadata = { title: "Auto reply" };

export default function AutoReplyPage() {
  return (
    <>
      <PageHeader
        title="Auto reply"
        description="Thank customers for good reviews automatically, in their own language. A short, polite thank-you, posted on Google."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <AutoReply />
      </Suspense>
    </>
  );
}

async function AutoReply() {
  const { business, location } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!location) return <NoProfile what="Auto reply" />;
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, { data: history }] = await Promise.all([
    supabase
      .from("clients")
      .select("auto_reply_since, auto_reply_min_stars")
      .eq("id", business.id)
      .single(),
    supabase
      .from("reviews")
      .select("id, reviewer, star_rating, comment, reply_comment, replied_at")
      .eq("client_id", business.id)
      .eq("replied_by", "auto")
      .order("replied_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <>
      <Panel>
        <AutoReplyForm
          action={saveOwnerAutoReply}
          enabled={Boolean(client?.auto_reply_since)}
          minStars={client?.auto_reply_min_stars ?? 4}
          since={client?.auto_reply_since ?? null}
        />
      </Panel>
      <Panel title="Automatic replies" description="The latest thank-yous posted for you">
        {history?.length ? (
          <ul className="divide-line flex flex-col divide-y">
            {history.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-semibold">{r.reviewer}</span>
                    {r.replied_at && (
                      <span className="text-ink-muted">, replied {fmtDate(r.replied_at)}</span>
                    )}
                  </p>
                  <Stars rating={r.star_rating} />
                </div>
                {r.comment && <p className="text-ink-muted line-clamp-2 text-sm">{r.comment}</p>}
                <p className="border-primary bg-primary-soft/50 rounded-r-lg border-l-2 px-3 py-2 text-sm">
                  {r.reply_comment}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No automatic replies yet.</Empty>
        )}
      </Panel>
    </>
  );
}
