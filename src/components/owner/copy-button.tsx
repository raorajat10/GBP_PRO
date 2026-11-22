"use client";

import { useState } from "react";

/** Copies text to the clipboard and says so. */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className = "border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm font-medium",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? copiedLabel : label}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}
