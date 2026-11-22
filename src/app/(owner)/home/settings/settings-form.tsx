"use client";

import { useActionState, useId } from "react";
import type { OwnerFormState } from "@/lib/owner/forms";
import { saveOwnerSettings } from "./actions";

export function SettingsForm({
  fullName,
  email,
  notifyWhatsapp,
  notifyEmail,
}: {
  fullName: string;
  email: string;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
}) {
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(saveOwnerSettings, {});
  const ids = { name: useId(), email: useId() };
  return (
    <form action={action} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.name} className="text-sm font-medium">
          Your name
        </label>
        <input
          id={ids.name}
          name="fullName"
          defaultValue={fullName}
          required
          maxLength={100}
          className="border-line bg-surface rounded-lg border px-3 py-2"
        />
        {state.errors?.fullName && <p className="text-danger text-sm">{state.errors.fullName[0]}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.email} className="text-sm font-medium">
          Sign-in email
        </label>
        <input id={ids.email} value={email} readOnly className="border-line bg-paper text-ink-muted rounded-lg border px-3 py-2" />
        <p className="text-ink-muted text-xs">To change it, ask our team under Help & support.</p>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Tell me about new reviews, posts and replies by</legend>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="notifyWhatsapp" defaultChecked={notifyWhatsapp} className="accent-primary size-4" />
          WhatsApp
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="notifyEmail" defaultChecked={notifyEmail} className="accent-primary size-4" />
          Email
        </label>
        <p className="text-ink-muted text-xs">
          Post approvals always come on WhatsApp, because nothing is published without your OK.
        </p>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
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
