"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import type { OwnerFormState } from "@/lib/owner/forms";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/owner/support";
import { createTicket } from "./actions";

const input = "border-line bg-surface w-full rounded-lg border px-3 py-2";

export function TicketForm() {
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(createTicket, {});
  const form = useRef<HTMLFormElement>(null);
  const ids = { subject: useId(), category: useId(), priority: useId(), description: useId() };
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  const err = (k: string) =>
    state.errors?.[k]?.[0] ? <p className="text-danger text-sm">{state.errors[k]![0]}</p> : null;

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.subject} className="text-sm font-medium">
          Subject
        </label>
        <input
          id={ids.subject}
          name="subject"
          required
          maxLength={150}
          className={input}
          placeholder="For example: wrong phone number on Google"
        />
        {err("subject")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.category} className="text-sm font-medium">
            About
          </label>
          <select id={ids.category} name="category" required defaultValue="" className={input}>
            <option value="" disabled>
              Choose one
            </option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {err("category")}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.priority} className="text-sm font-medium">
            How urgent?
          </label>
          <select id={ids.priority} name="priority" defaultValue="medium" className={input}>
            {TICKET_PRIORITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.description} className="text-sm font-medium">
          What do you need?
        </label>
        <textarea
          id={ids.description}
          name="description"
          required
          rows={5}
          maxLength={4000}
          className={input}
        />
        {err("description")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send to our team"}
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
