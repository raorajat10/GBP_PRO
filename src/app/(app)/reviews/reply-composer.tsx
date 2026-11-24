"use client";

import { useActionState, useId, useState } from "react";
import { MAX_REPLY_LENGTH } from "@/lib/reviews/language";
import type { ThankYouOption } from "@/lib/reviews/thank-you";
import { postReplyAction, type PostState } from "./actions";

/** Pick a ready-made thank-you (or edit it), then post the reply to Google. */
export function ReplyComposer({
  reviewId,
  existingReply,
  options,
}: {
  reviewId: string;
  existingReply: string | null;
  options: ThankYouOption[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existingReply ?? options[0]?.text ?? "");
  const [state, post, posting] = useActionState<PostState, FormData>(
    postReplyAction.bind(null, reviewId),
    {},
  );
  const id = useId();
  // Close the composer once the reply is on Google.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            existingReply
              ? "text-primary text-sm font-semibold hover:underline"
              : "bg-primary text-primary-ink rounded-lg px-3 py-1.5 text-sm font-semibold"
          }
        >
          {existingReply ? "Edit reply" : "Reply"}
        </button>
        {state.ok && (
          <p role="status" className="text-success text-sm">
            {state.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={post} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ready replies">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={text === o.text}
            onClick={() => setText(o.text)}
            className={
              text === o.text
                ? "bg-primary-soft text-primary border-primary rounded-full border px-3 py-1 text-sm font-semibold"
                : "border-line hover:border-primary rounded-full border px-3 py-1 text-sm"
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      <label htmlFor={id} className="text-sm font-medium">
        Reply that goes on Google
      </label>
      <textarea
        id={id}
        name="reply"
        rows={3}
        required
        maxLength={MAX_REPLY_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="border-line bg-surface rounded-lg border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={posting || text.trim().length < 2}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {posting ? "Posting…" : existingReply ? "Update reply on Google" : "Post reply on Google"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-line hover:bg-paper rounded-lg border px-3 py-2 text-sm"
        >
          Cancel
        </button>
        {state.message && !state.ok && (
          <p role="alert" className="text-danger w-full text-sm">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
