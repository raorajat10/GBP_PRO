"use client";

import { useActionState, useState } from "react";
import type { OwnerFormState } from "@/lib/owner/forms";
import { requestAttributeChange } from "../actions";

/** Yes/No switches per attribute; sending asks our team to apply only what changed. */
export function AttributeForm({
  groups,
  current,
}: {
  groups: { label: string; items: { key: string; label: string }[] }[];
  current: string[];
}) {
  const [on, setOn] = useState(() => new Set(current));
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(
    requestAttributeChange,
    {},
  );
  const changed = on.size !== current.length || current.some((k) => !on.has(k));

  return (
    <form action={action} className="flex flex-col gap-4">
      {[...on].map((k) => (
        <input key={k} type="hidden" name="attr" value={k} />
      ))}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.label} className="border-line bg-surface rounded-2xl border p-5">
            <legend className="sr-only">{g.label}</legend>
            <p aria-hidden="true" className="mb-3 text-lg font-bold">
              {g.label}
            </p>
            <ul className="divide-line flex flex-col divide-y">
              {g.items.map((item) => {
                const checked = on.has(item.key);
                return (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm">{item.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      aria-label={item.label}
                      onClick={() =>
                        setOn((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.key)) next.delete(item.key);
                          else next.add(item.key);
                          return next;
                        })
                      }
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        checked ? "bg-primary" : "bg-line"
                      }`}
                    >
                      <span
                        className={`bg-surface absolute top-0.5 size-5 rounded-full shadow transition-transform ${
                          checked ? "translate-x-5.5" : "translate-x-0.5"
                        }`}
                      />
                      <span className="sr-only">{checked ? "Yes" : "No"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !changed}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
        >
          {pending ? "Sending…" : "Ask our team to update Google"}
        </button>
        {changed ? (
          <button
            type="button"
            onClick={() => setOn(new Set(current))}
            className="text-ink-muted text-sm hover:underline"
          >
            Undo my changes
          </button>
        ) : (
          <span className="text-ink-muted text-sm">Flip a switch to change what Google shows.</span>
        )}
        {state.message && (
          <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
