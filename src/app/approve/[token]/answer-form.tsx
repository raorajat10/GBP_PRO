"use client";

import { useActionState, useState } from "react";
import { inputClass } from "@/components/form-field";
import type { AnswerState } from "./actions";

export function AnswerForm({
  action,
  expiresText,
}: {
  action: (prev: AnswerState, fd: FormData) => Promise<AnswerState>;
  expiresText: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {changing ? (
        <>
          <label htmlFor="note" className="font-medium">
            What should we change?
          </label>
          <textarea
            id="note"
            name="note"
            rows={4}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Please mention the Diwali offer, and use a different photo."
            className={inputClass}
          />
          <button
            type="submit"
            name="decision"
            value="changes_requested"
            disabled={pending}
            className="bg-primary text-primary-ink rounded-xl px-4 py-3 text-lg font-semibold disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send to our team"}
          </button>
          <button
            type="button"
            onClick={() => setChanging(false)}
            className="text-ink-muted text-sm underline"
          >
            Back
          </button>
        </>
      ) : (
        <>
          <button
            type="submit"
            name="decision"
            value="approved"
            disabled={pending}
            className="bg-primary text-primary-ink rounded-xl px-4 py-3 text-lg font-semibold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Approve ✅"}
          </button>
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="border-line bg-surface rounded-xl border px-4 py-3 text-lg"
          >
            Request change ✏️
          </button>
        </>
      )}
      {state.message && (
        <p role="alert" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
      <p className="text-ink-muted text-xs">
        Nothing is posted without your approval. This request is open until {expiresText}.
      </p>
    </form>
  );
}
