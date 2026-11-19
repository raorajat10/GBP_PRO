"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { inputClass } from "@/components/form-field";
import type { InviteState } from "../invite-actions";

type Action = (prev: InviteState, fd: FormData) => Promise<InviteState>;

export function InviteForm({ action, businessName }: { action: Action; businessName: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [email, setEmail] = useState("");
  const router = useRouter();
  const sent = Boolean(state.ok && state.link);

  return (
    <div className="flex flex-col gap-3">
      {!sent && (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">Owner&apos;s email (optional)</span>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            {pending ? "Creating…" : email ? "Email invite" : "Create invite link"}
          </button>
        </form>
      )}
      {state.message && (
        <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
      {state.emailError && <p className="text-danger text-sm">{state.emailError}</p>}
      {state.link && (
        <ShareLink
          link={state.link}
          text={`Please connect ${businessName}'s Google Business Profile so our team can manage it: ${state.link}`}
        />
      )}
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

function ShareLink({ link, text }: { link: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-line bg-paper flex flex-col gap-2 rounded-lg border p-3">
      <label htmlFor="invite-link" className="text-sm font-medium">
        Invite link (shown once — copy it now)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="invite-link"
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
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
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

export function CancelInviteButton({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={pending} className="text-danger text-sm underline">
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {state.message && !state.ok && (
        <span className="text-danger ml-2 text-xs">{state.message}</span>
      )}
    </form>
  );
}
