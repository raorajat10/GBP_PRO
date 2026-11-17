"use client";

import { useActionState } from "react";
import { Field, inputClass } from "@/components/form-field";
import { INDUSTRIES, LANGUAGES, STATUSES } from "@/lib/clients/schema";
import type { FormState } from "./actions";

export interface ClientDefaults {
  business_name: string;
  owner_name: string | null;
  owner_whatsapp: string | null;
  whatsapp_opt_in_at: string | null;
  preferred_language: string;
  industry: string | null;
  brand_notes: string | null;
  assigned_manager_id: string | null;
  status: string;
}

export interface ManagerOption {
  id: string;
  label: string;
}

export function ClientForm({
  action,
  defaults,
  managers,
  canAssign,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: ClientDefaults;
  managers: ManagerOption[];
  canAssign: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <fieldset className="border-line bg-surface grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Business</legend>
        <Field label="Business name" name="businessName" errors={e.businessName}>
          <input
            id="businessName"
            name="businessName"
            required
            maxLength={200}
            defaultValue={defaults?.business_name}
            className={inputClass}
          />
        </Field>
        <Field label="Type of business" name="industry" errors={e.industry}>
          <select
            id="industry"
            name="industry"
            defaultValue={defaults?.industry ?? ""}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {INDUSTRIES.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" name="status" errors={e.status}>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "active"}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Account manager"
          name="assignedManagerId"
          errors={e.assignedManagerId}
          hint={canAssign ? undefined : "Only an admin can change this."}
        >
          <select
            id="assignedManagerId"
            name="assignedManagerId"
            defaultValue={defaults?.assigned_manager_id ?? ""}
            disabled={!canAssign}
            className={inputClass}
          >
            <option value="">Not assigned</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="border-line bg-surface grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Owner</legend>
        <Field label="Owner name" name="ownerName" errors={e.ownerName}>
          <input
            id="ownerName"
            name="ownerName"
            maxLength={100}
            defaultValue={defaults?.owner_name ?? ""}
            className={inputClass}
          />
        </Field>
        <Field
          label="WhatsApp number"
          name="ownerWhatsapp"
          errors={e.ownerWhatsapp}
          hint="10-digit mobile is fine — we add +91."
        >
          <input
            id="ownerWhatsapp"
            name="ownerWhatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={defaults?.owner_whatsapp ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Message language" name="preferredLanguage" errors={e.preferredLanguage}>
          <select
            id="preferredLanguage"
            name="preferredLanguage"
            defaultValue={defaults?.preferred_language ?? "en"}
            className={inputClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="whatsappOptIn"
              defaultChecked={Boolean(defaults?.whatsapp_opt_in_at)}
              className="accent-primary mt-1 size-4"
            />
            <span className="text-sm">
              The owner has agreed to receive approval requests and weekly reports from us on
              WhatsApp.
              {defaults?.whatsapp_opt_in_at && (
                <span className="text-ink-muted">
                  {" "}
                  (since{" "}
                  {new Date(defaults.whatsapp_opt_in_at).toLocaleDateString("en-IN", {
                    dateStyle: "medium",
                  })}
                  )
                </span>
              )}
            </span>
          </label>
          {e.whatsappOptIn?.[0] && <p className="text-danger text-sm">{e.whatsappOptIn[0]}</p>}
        </div>
      </fieldset>

      <fieldset className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5">
        <legend className="px-1 text-lg font-semibold">Brand notes for AI writing</legend>
        <Field
          label="Tone, selling points, things to avoid"
          name="brandNotes"
          errors={e.brandNotes}
          hint="Used when drafting posts and review replies. E.g. “Family business since 1998. Mention free installation. Never quote prices.”"
        >
          <textarea
            id="brandNotes"
            name="brandNotes"
            rows={4}
            maxLength={2000}
            defaultValue={defaults?.brand_notes ?? ""}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-ink rounded-lg px-5 py-2.5 font-semibold disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
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
