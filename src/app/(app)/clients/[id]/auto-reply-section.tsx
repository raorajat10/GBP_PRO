import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AutoReplyForm } from "@/components/auto-reply-form";
import { saveClientAutoReply, thankBacklogForClient } from "../auto-reply-actions";
import { countUnansweredGood } from "@/lib/reviews/auto-reply";
import { BacklogButton } from "@/components/backlog-button";

/** Team view of a client's auto reply setting. Caller has checked access to the client. */
export async function AutoReplySection({ clientId }: { clientId: string }) {
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, { count }] = await Promise.all([
    supabase
      .from("clients")
      .select("auto_reply_since, auto_reply_min_stars")
      .eq("id", clientId)
      .single(),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("replied_by", "auto"),
  ]);
  const minStars = client?.auto_reply_min_stars ?? 4;
  const backlog = await countUnansweredGood(clientId, minStars);
  return (
    <section
      aria-labelledby="auto-reply-h"
      className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5"
    >
      <div>
        <h2 id="auto-reply-h" className="text-lg font-bold">
          Auto reply
        </h2>
        <p className="text-ink-muted text-sm">
          {count ? `${count} automatic thank-yous posted so far.` : "No automatic replies yet."}
        </p>
      </div>
      <AutoReplyForm
        action={saveClientAutoReply.bind(null, clientId)}
        enabled={Boolean(client?.auto_reply_since)}
        minStars={client?.auto_reply_min_stars ?? 4}
        since={client?.auto_reply_since ?? null}
      />
      <BacklogButton
        count={backlog}
        minStars={minStars}
        action={thankBacklogForClient.bind(null, clientId)}
      />
    </section>
  );
}
