import { ActionForm } from "@/components/action-form";

/** One tap: thank every old good review that still has no reply. */
export function BacklogButton({
  count,
  minStars,
  action,
}: {
  count: number;
  minStars: number;
  action: (
    prev: { ok?: boolean; message?: string },
    fd: FormData,
  ) => Promise<{ ok?: boolean; message?: string }>;
}) {
  return (
    <div className="border-line flex flex-col gap-2 border-t pt-4">
      <p className="text-sm">
        {count
          ? `${count} older ${count === 1 ? "review" : "reviews"} with ${minStars}★ or more ${count === 1 ? "has" : "have"} no reply yet.`
          : `Every review with ${minStars}★ or more has a reply.`}
      </p>
      {/* Always rendered, so the result message stays visible after the last batch. */}
      <ActionForm
        action={action}
        label={
          count
            ? `Thank all unanswered good reviews (${count})`
            : "Thank all unanswered good reviews"
        }
        pendingLabel="Posting thank-yous…"
        variant="secondary"
        confirm={
          count
            ? `Post a thank-you reply on Google to ${Math.min(count, 50)} ${count === 1 ? "review" : "reviews"}? Low ratings are skipped.`
            : undefined
        }
      />
      {count > 50 && (
        <p className="text-ink-muted text-xs">
          Up to 50 are posted per press, to stay within Google&apos;s limits.
        </p>
      )}
    </div>
  );
}
