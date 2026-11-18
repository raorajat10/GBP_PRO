"use client";

import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/form-field";
import { charCount, CTA_TYPES, ISSUE_TEXT, POST_MAX_CHARS, postIssues } from "@/lib/posts/rules";
import type { FormState } from "../../../actions";

interface Defaults {
  body: string;
  ctaType: string;
  ctaUrl: string;
  scheduledFor: string;
}

const nf = new Intl.NumberFormat("en-IN");

export function PostEditor({
  action,
  editable,
  photoUrl,
  drafts,
  defaults,
  minTime,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  editable: boolean;
  photoUrl: string | null;
  drafts: { angle: string; body: string }[];
  defaults: Defaults;
  /** Earliest time the picker offers (India time); the server checks again on save. */
  minTime: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState(defaults.body);
  const [ctaType, setCtaType] = useState(defaults.ctaType);
  const [ctaUrl, setCtaUrl] = useState(defaults.ctaUrl);
  const [scheduledFor, setScheduledFor] = useState(defaults.scheduledFor);
  const e = state.fieldErrors ?? {};

  const count = charCount(body.trim());
  const issues = postIssues(body).filter((i) => i !== "too_long");
  const cta = CTA_TYPES.find((c) => c.value === ctaType);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <form
        action={formAction}
        className="border-line bg-surface flex flex-col gap-5 rounded-2xl border p-5"
        noValidate
      >
        {drafts.length > 0 && editable && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Pick a draft to start from</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {drafts.map((d, i) => {
                const chosen = d.body === body;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBody(d.body)}
                    aria-pressed={chosen}
                    className={`flex flex-col gap-1 rounded-xl border p-3 text-left text-sm ${
                      chosen
                        ? "border-primary bg-primary-soft"
                        : "border-line bg-paper hover:border-primary"
                    }`}
                  >
                    <span className="font-semibold">
                      {i + 1}. {d.angle}
                      {chosen && <span className="text-primary"> ✓</span>}
                    </span>
                    <span className="text-ink-muted line-clamp-4 whitespace-pre-line">
                      {d.body}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <Field label="Post text" name="body" errors={e.body}>
          <textarea
            id="body"
            name="body"
            rows={10}
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            readOnly={!editable}
            className={inputClass}
            aria-describedby="body-count"
            aria-invalid={Boolean(e.body) || count > POST_MAX_CHARS || issues.length > 0}
          />
        </Field>
        <div id="body-count" className="-mt-3 flex flex-wrap justify-between gap-2 text-xs">
          <span className={count > POST_MAX_CHARS ? "text-danger font-semibold" : "text-ink-muted"}>
            {nf.format(count)} / {nf.format(POST_MAX_CHARS)} characters
          </span>
          {issues.map((i) => (
            <span key={i} className="text-danger">
              {ISSUE_TEXT[i]}
            </span>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button" name="ctaType" errors={e.ctaType}>
            <select
              id="ctaType"
              name="ctaType"
              value={ctaType}
              onChange={(ev) => setCtaType(ev.target.value)}
              disabled={!editable}
              className={inputClass}
            >
              <option value="">No button</option>
              {CTA_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {cta?.needsUrl && (
            <Field label="Button link" name="ctaUrl" errors={e.ctaUrl}>
              <input
                id="ctaUrl"
                name="ctaUrl"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={ctaUrl}
                onChange={(ev) => setCtaUrl(ev.target.value)}
                readOnly={!editable}
                className={inputClass}
              />
            </Field>
          )}
        </div>

        <Field
          label="Publish on (India time, optional)"
          name="scheduledFor"
          hint="The post goes live only after the owner approves it. Sending for approval comes in the next update."
          errors={e.scheduledFor}
        >
          <input
            id="scheduledFor"
            name="scheduledFor"
            type="datetime-local"
            min={minTime}
            value={scheduledFor}
            onChange={(ev) => setScheduledFor(ev.target.value)}
            readOnly={!editable}
            className={`${inputClass} sm:max-w-64`}
          />
        </Field>

        {editable && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
            {state.message && (
              <p
                role="status"
                className={state.ok ? "text-success text-sm" : "text-danger text-sm"}
              >
                {state.message}
              </p>
            )}
          </div>
        )}
      </form>

      <aside aria-label="Preview" className="flex flex-col gap-2">
        <p className="text-ink-muted text-sm font-medium">Preview</p>
        <div className="border-line bg-surface overflow-hidden rounded-2xl border">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={photoUrl} alt="Post photo" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="bg-paper text-ink-muted flex aspect-[4/3] items-center justify-center text-sm">
              No photo
            </div>
          )}
          <div className="flex flex-col gap-3 p-4">
            <p className="line-clamp-[12] text-sm whitespace-pre-line">{body.trim() || "—"}</p>
            {cta && <span className="text-primary w-fit text-sm font-semibold">{cta.label}</span>}
          </div>
        </div>
      </aside>
    </div>
  );
}
