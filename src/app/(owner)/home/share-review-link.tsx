"use client";

import { useState } from "react";

/** Copy or WhatsApp-share the business's public /review/<slug> page. */
export function ShareReviewLink({
  slug,
  businessName,
  appUrl,
}: {
  slug: string;
  businessName: string;
  appUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${appUrl.replace(/\/$/, "")}/review/${encodeURIComponent(slug)}`;
  const message = `Thank you for choosing ${businessName}! If you were happy with us, please share your experience here: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-primary text-primary-ink rounded-lg px-3 py-1.5 text-sm font-semibold"
      >
        Share on WhatsApp
      </a>
      <button
        type="button"
        onClick={copy}
        className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm font-medium"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      <a
        href={`/review/${encodeURIComponent(slug)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary text-sm font-medium underline-offset-2 hover:underline"
      >
        Preview page
      </a>
      <span aria-live="polite" className="sr-only">
        {copied ? "Review link copied" : ""}
      </span>
    </div>
  );
}
