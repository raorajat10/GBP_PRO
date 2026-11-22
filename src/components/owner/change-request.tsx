"use client";

import { useActionState, useId, useState } from "react";
import type { OwnerFormState } from "@/lib/owner/forms";
import { requestChange } from "@/app/(owner)/home/listing/actions";

/** "Ask for a change" link that opens a short note to our team about one area. */
export function ChangeRequest({
  area,
  label = "Ask for a change",
  placeholder = "What should we change? For example: we now close at 8 pm on Sundays.",
}: {
  area: string;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(requestChange, {});
  const id = useId();
  // Close the form once a request has been sent.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-primary text-sm font-semibold hover:underline"
        >
          {label}
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
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="area" value={area} />
      <label htmlFor={id} className="text-sm font-medium">
        Your request
      </label>
      <textarea
        id={id}
        name="message"
        rows={3}
        required
        maxLength={2000}
        placeholder={placeholder}
        className="border-line bg-surface w-full rounded-lg border px-3 py-2 text-sm"
        aria-invalid={state.errors?.message ? true : undefined}
      />
      {state.errors?.message && <p className="text-danger text-sm">{state.errors.message[0]}</p>}
      {state.message && !state.ok && (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-ink rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send to our team"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
