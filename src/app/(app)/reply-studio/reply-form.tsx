"use client";

import { useActionState, useState } from "react";
import { createReplyDrafts } from "./actions";

type Draft = { title: string; text: string };
type Result = { error?: string; sample?: boolean; drafts?: Draft[] };

export function ReplyForm() {
  const [result, action, pending] = useActionState<Result, FormData>(createReplyDrafts, {});
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const drafts = result.drafts ?? [];

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <section className="border-line bg-surface grid content-start gap-5 rounded-2xl border p-5 sm:p-7">
        <div>
          <p className="text-primary text-sm font-semibold">01 / Add context</p>
          <h2 className="mt-1 text-xl font-bold">Paste the customer&apos;s review</h2>
          <p className="text-ink-muted mt-1 text-sm">
            We&apos;ll draft a reply that speaks to what they actually said.
          </p>
        </div>
        <label className="grid gap-2 text-sm font-semibold" htmlFor="review">
          Review text
          <textarea
            id="review"
            name="review"
            required
            minLength={10}
            maxLength={5000}
            rows={7}
            placeholder="Paste the full review here…"
            className="border-line focus:border-primary focus:ring-primary/20 rounded-xl border bg-transparent p-3 font-normal outline-none focus:ring-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold" htmlFor="business">
            Business name
            <input
              id="business"
              name="business"
              required
              maxLength={100}
              placeholder="e.g. Sarvatra Energy"
              className="border-line focus:border-primary focus:ring-primary/20 rounded-xl border bg-transparent px-3 py-2.5 font-normal outline-none focus:ring-2"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="language">
            Reply language
            <select
              id="language"
              name="language"
              defaultValue="en"
              className="border-line bg-surface rounded-xl border px-3 py-2.5 font-normal"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-ink rounded-xl px-5 py-3 font-semibold disabled:opacity-60"
        >
          {pending ? "Writing reply options…" : "Create reply drafts"}
        </button>
        {result.error && (
          <p role="alert" className="text-danger text-sm">
            {result.error}
          </p>
        )}
      </section>

      <section className="border-line bg-surface rounded-2xl border p-5 sm:p-7" aria-live="polite">
        <p className="text-primary text-sm font-semibold">02 / Choose a reply</p>
        <h2 className="mt-1 text-xl font-bold">Your reply drafts</h2>
        {!drafts.length ? (
          <div className="text-ink-muted border-line mt-5 rounded-xl border border-dashed p-6 text-sm">
            Your options will appear here. Pick the one that sounds right, edit it, then copy it to
            Google.
          </div>
        ) : (
          <>
            {result.sample && (
              <p className="bg-accent-soft mt-4 rounded-lg px-3 py-2 text-sm">
                Sample drafts — add ANTHROPIC_API_KEY for tailored AI replies.
              </p>
            )}
            <div className="mt-4 grid gap-2" role="tablist" aria-label="Reply drafts">
              {drafts.map((draft, index) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected === index}
                  key={`${draft.title}-${index}`}
                  onClick={() => {
                    setSelected(index);
                    setCopied(false);
                  }}
                  className={`rounded-xl border p-3 text-left ${selected === index ? "border-primary bg-primary-soft" : "border-line hover:border-primary"}`}
                >
                  <span className="text-sm font-semibold">{draft.title}</span>
                  <span className="text-ink-muted mt-0.5 block text-xs">Option {index + 1}</span>
                </button>
              ))}
            </div>
            <label
              htmlFor="draft-text"
              className="text-ink-muted mt-5 block text-xs font-semibold tracking-wide uppercase"
            >
              Selected draft · editable
            </label>
            <textarea
              id="draft-text"
              key={selected}
              defaultValue={drafts[selected]?.text}
              rows={7}
              maxLength={1500}
              className="border-line focus:border-primary focus:ring-primary/20 mt-2 w-full rounded-xl border bg-transparent p-3 text-sm outline-none focus:ring-2"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-ink-muted text-xs">Review every reply before posting.</span>
              <button
                type="button"
                onClick={async () => {
                  const field = document.getElementById("draft-text") as HTMLTextAreaElement | null;
                  if (field) {
                    await navigator.clipboard.writeText(field.value);
                    setCopied(true);
                  }
                }}
                className="bg-ink text-surface rounded-lg px-4 py-2 text-sm font-semibold"
              >
                {copied ? "Copied" : "Copy reply"}
              </button>
            </div>
          </>
        )}
      </section>
    </form>
  );
}
