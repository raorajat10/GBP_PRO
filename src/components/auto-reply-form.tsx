"use client";

import { useActionState, useId, useState } from "react";

interface State {
  ok?: boolean;
  message?: string;
}

/** On/off switch and star level for auto reply. Used by the owner portal and the team. */
export function AutoReplyForm({
  action,
  enabled,
  minStars,
  since,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  enabled: boolean;
  minStars: number;
  since: string | null;
}) {
  const [on, setOn] = useState(enabled);
  const [stars, setStars] = useState(String(minStars));
  const [state, formAction, pending] = useActionState(action, {});
  const ids = { stars: useId() };
  const changed = on !== enabled || stars !== String(minStars);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="enabled" value={on ? "on" : "off"} />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Thank new good reviews automatically</p>
          <p className="text-ink-muted text-sm">
            {enabled && since
              ? `On since ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(since))}. Older reviews are never answered automatically.`
              : "Only reviews written after you switch this on get an automatic reply."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Auto reply"
          onClick={() => setOn((v) => !v)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-line"}`}
        >
          <span
            className={`bg-surface absolute top-0.5 size-6 rounded-full shadow transition-transform ${on ? "translate-x-5.5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={ids.stars} className="text-sm font-medium">
          Reply automatically to
        </label>
        <select
          id={ids.stars}
          name="minStars"
          value={stars}
          onChange={(e) => setStars(e.target.value)}
          className="border-line bg-surface rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="5">5-star reviews only</option>
          <option value="4">4 and 5-star reviews</option>
          <option value="3">3, 4 and 5-star reviews</option>
        </select>
      </div>
      <p className="text-ink-muted text-xs">
        Lower ratings are always left for a person to answer. Replies are posted after each daily
        update of your Google profile.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !changed}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.message && (
          <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
