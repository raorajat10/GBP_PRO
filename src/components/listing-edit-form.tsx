"use client";

import { useActionState, useState } from "react";
import { DAYS, DESCRIPTION_MAX, type HoursSlot } from "@/lib/gbp/listing-edit";

export interface ListingEditState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

type Mode = "closed" | "hours" | "24h" | "keep";

function initialMode(slots: HoursSlot[]): Mode {
  if (!slots.length) return "closed";
  if (slots.length > 1) return "keep";
  return slots[0].open === "00:00" && slots[0].close === "24:00" ? "24h" : "hours";
}

const field = "border-line bg-surface rounded-lg border px-3 py-2";

/** Edit phone, website, description and opening hours; changes go straight to Google. */
export function ListingEditForm({
  action,
  profile,
}: {
  action: (prev: ListingEditState, fd: FormData) => Promise<ListingEditState>;
  profile: {
    phone: string | null;
    website: string | null;
    description: string | null;
    hours: HoursSlot[];
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [description, setDescription] = useState(profile.description ?? "");
  const byDay = (day: string) => profile.hours.filter((h) => h.day === day);
  const [modes, setModes] = useState<Record<string, Mode>>(() =>
    Object.fromEntries(DAYS.map((d) => [d.key, initialMode(byDay(d.key))])),
  );
  const err = (k: string) =>
    state.errors?.[k] ? <p className="text-danger text-sm">{state.errors[k]}</p> : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="hours" value="1" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-phone" className="text-sm font-medium">
            Phone
          </label>
          <input
            id="edit-phone"
            name="phone"
            defaultValue={profile.phone ?? ""}
            inputMode="tel"
            className={field}
          />
          {err("phone")}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-website" className="text-sm font-medium">
            Website
          </label>
          <input
            id="edit-website"
            name="website"
            defaultValue={profile.website ?? ""}
            inputMode="url"
            className={field}
          />
          {err("website")}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="edit-description" className="text-sm font-medium">
          Business description
        </label>
        <textarea
          id="edit-description"
          name="description"
          rows={5}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={field}
        />
        <p className="text-ink-muted text-xs tabular-nums">
          {description.length} / {DESCRIPTION_MAX}. No links or phone numbers; Google removes them.
        </p>
        {err("description")}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Opening hours</legend>
        {DAYS.map((d) => {
          const mode = modes[d.key];
          const slots = byDay(d.key);
          return (
            <div key={d.key} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm">{d.label}</span>
                <select
                  aria-label={`${d.label} hours`}
                  name={`hours.${d.key}.mode`}
                  value={mode}
                  onChange={(e) => setModes((m) => ({ ...m, [d.key]: e.target.value as Mode }))}
                  className="border-line bg-surface rounded-lg border px-2 py-1.5 text-sm"
                >
                  <option value="closed">Closed</option>
                  <option value="hours">Open</option>
                  <option value="24h">Open 24 hours</option>
                  {slots.length > 1 && <option value="keep">Keep split hours</option>}
                </select>
                {mode === "hours" && (
                  <>
                    <input
                      type="time"
                      aria-label={`${d.label} opens`}
                      name={`hours.${d.key}.open`}
                      defaultValue={
                        slots[0] && slots[0].close !== "24:00" ? slots[0].open : "09:00"
                      }
                      className="border-line bg-surface rounded-lg border px-2 py-1 text-sm"
                    />
                    <span className="text-ink-muted text-sm">to</span>
                    <input
                      type="time"
                      aria-label={`${d.label} closes`}
                      name={`hours.${d.key}.close`}
                      defaultValue={
                        slots[0] && slots[0].close !== "24:00" ? slots[0].close : "19:00"
                      }
                      className="border-line bg-surface rounded-lg border px-2 py-1 text-sm"
                    />
                  </>
                )}
                {mode === "keep" && (
                  <>
                    <span className="text-ink-muted text-sm">
                      {slots.map((s) => `${s.open}–${s.close}`).join(", ")}
                    </span>
                    <input
                      type="hidden"
                      name={`hours.${d.key}.slots`}
                      value={JSON.stringify(slots)}
                    />
                  </>
                )}
              </div>
              {err(`hours.${d.key}`)}
            </div>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
        >
          {pending ? "Saving to Google…" : "Save to Google"}
        </button>
        <span className="text-ink-muted text-xs">
          Changes can take a few minutes to show on Google.
        </span>
        {state.message && (
          <p
            role="status"
            className={state.ok ? "text-success w-full text-sm" : "text-danger w-full text-sm"}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
