"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import type { OwnerFormState } from "@/lib/owner/forms";
import { addKeywordAction, scanNowAction } from "./actions";

const RADII = [1, 2, 5, 10, 15, 25];
const field = "border-line bg-surface rounded-lg border px-3 py-2";

export function AddKeywordForm() {
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(addKeywordAction, {});
  const form = useRef<HTMLFormElement>(null);
  const ids = { keyword: useId(), size: useId(), radius: useId() };
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <label htmlFor={ids.keyword} className="text-sm font-medium">
            Keyword
          </label>
          <input
            id={ids.keyword}
            name="keyword"
            required
            maxLength={80}
            placeholder="solar company in jaipur"
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.size} className="text-sm font-medium">
            Grid
          </label>
          <select id={ids.size} name="gridSize" defaultValue="5" className={field}>
            <option value="3">3 × 3 (9 points)</option>
            <option value="5">5 × 5 (25 points)</option>
            <option value="7">7 × 7 (49 points)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.radius} className="text-sm font-medium">
            Distance from you
          </label>
          <select id={ids.radius} name="radiusKm" defaultValue="5" className={field}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
        >
          {pending ? "Adding…" : "Track keyword"}
        </button>
      </div>
      {Object.values(state.errors ?? {})
        .flat()
        .filter(Boolean)
        .slice(0, 1)
        .map((m) => (
          <p key={m} className="text-danger text-sm">
            {m}
          </p>
        ))}
      {state.message && (
        <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ScanNowButton({
  keywordId,
  points,
  left,
}: {
  keywordId: string;
  points: number;
  left: number;
}) {
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(scanNowAction, {});
  const enough = left >= points;
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="keywordId" value={keywordId} />
      <button
        type="submit"
        disabled={pending || !enough}
        className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
      >
        {pending ? "Scanning…" : "Scan now"}
      </button>
      <span className="text-ink-muted text-sm">
        {enough
          ? `Uses ${points} of your ${left} grid points left this month.`
          : `Needs ${points} grid points; ${left} left this month.`}
      </span>
      {state.message && (
        <p role="alert" className="text-danger w-full text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
