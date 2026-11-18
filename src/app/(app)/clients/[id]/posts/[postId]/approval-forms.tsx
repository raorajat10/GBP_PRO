"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import type { SendState } from "../../../approval-actions";

type Action = (prev: SendState, fd: FormData) => Promise<SendState>;

export function SendForm({ action, label }: { action: Action; label: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  const sent = Boolean(state.ok && state.link);
  return (
    <div className="flex flex-col gap-3">
      {!sent && (
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            {pending ? "Sending…" : label}
          </button>
        </form>
      )}
      {state.message && (
        <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
      {state.whatsappError && (
        <p className="text-danger text-sm">
          WhatsApp failed: {state.whatsappError} Send the link below instead.
        </p>
      )}
      {state.link && <LinkBox link={state.link} />}
      {sent && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="border-line hover:bg-paper w-fit rounded-lg border px-4 py-2 text-sm"
        >
          Done
        </button>
      )}
    </div>
  );
}

function LinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-line bg-paper flex flex-col gap-2 rounded-lg border p-3">
      <label htmlFor="approval-link" className="text-sm font-medium">
        Approval link (shown once — copy it now)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="approval-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="border-line bg-surface min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link).catch(() => undefined);
            setCopied(true);
          }}
          className="border-line hover:bg-surface rounded-lg border px-3 py-2 text-sm"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Please approve your new Google post: ${link}`)}`}
          target="_blank"
          rel="noreferrer"
          className="border-line hover:bg-surface rounded-lg border px-3 py-2 text-sm"
        >
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}

export function CancelForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Cancel this request? The owner's link will stop working.")) {
          e.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <button
        type="submit"
        disabled={pending}
        className="border-danger text-danger rounded-lg border px-4 py-2 disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
      {state.message && (
        <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
