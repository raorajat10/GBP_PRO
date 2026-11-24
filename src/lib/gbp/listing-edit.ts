/**
 * Editing a Google Business Profile: which fields we let people change, how they're checked,
 * and how an edit becomes a Business Information API "PATCH locations/{id}". Pure and
 * unit-tested; the provider only sends what this builds.
 */
import { z } from "zod";
import type { DayOfWeek, GbpLocation } from "./types";

export const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
];

export const DESCRIPTION_MAX = 750; // Google's limit for the business description

export interface HoursSlot {
  day: DayOfWeek;
  open: string; // "HH:MM"
  close: string; // "HH:MM", or "24:00" with open "00:00" for open all day
}

/** Only the fields that changed are set. */
export interface ListingEdit {
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  hours?: HoursSlot[];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Indian numbers: accepts "98290 12345", "+91 98290-12345", "0141 2345678"; returns "+91 …". */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (!/^\d{10}$/.test(d)) return null;
  return d.startsWith("6") || d.startsWith("7") || d.startsWith("8") || d.startsWith("9")
    ? `+91 ${d.slice(0, 5)} ${d.slice(5)}`
    : `+91 ${d}`;
}

export function normaliseWebsite(raw: string): string | null {
  const v = raw.trim();
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Form fields → a checked edit, or field errors. Only fields present in the form count. */
export function parseListingForm(
  fd: FormData,
): { ok: true; edit: ListingEdit } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const edit: ListingEdit = {};

  if (fd.has("phone")) {
    const raw = String(fd.get("phone") ?? "").trim();
    if (!raw) edit.phone = null;
    else {
      const p = normalisePhone(raw);
      if (p) edit.phone = p;
      else errors.phone = "Enter a 10-digit Indian phone number.";
    }
  }
  if (fd.has("website")) {
    const raw = String(fd.get("website") ?? "").trim();
    if (!raw) edit.website = null;
    else {
      const w = normaliseWebsite(raw);
      if (w) edit.website = w;
      else errors.website = "Enter a website address, for example sarvatraenergy.com.";
    }
  }
  if (fd.has("description")) {
    const raw = String(fd.get("description") ?? "").trim();
    if (raw.length > DESCRIPTION_MAX) {
      errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
    } else if (/https?:\/\/|www\./i.test(raw)) {
      errors.description = "Google doesn't allow links in the description.";
    } else edit.description = raw || null;
  }
  if (fd.has("hours")) {
    const hours: HoursSlot[] = [];
    for (const d of DAYS) {
      const mode = String(fd.get(`hours.${d.key}.mode`) ?? "closed");
      if (mode === "closed") continue;
      if (mode === "24h") {
        hours.push({ day: d.key, open: "00:00", close: "24:00" });
        continue;
      }
      if (mode === "keep") {
        // Split hours (e.g. a lunch break) the form doesn't edit: keep them exactly.
        const kept = keptSlots(fd.get(`hours.${d.key}.slots`), d.key);
        if (kept) hours.push(...kept);
        else errors[`hours.${d.key}`] = `Set the hours for ${d.label} again.`;
        continue;
      }
      const open = String(fd.get(`hours.${d.key}.open`) ?? "");
      const close = String(fd.get(`hours.${d.key}.close`) ?? "");
      if (!TIME.test(open) || !TIME.test(close)) {
        errors[`hours.${d.key}`] = `Set opening and closing times for ${d.label}.`;
      } else if (close <= open) {
        errors[`hours.${d.key}`] = `${d.label}: closing time must be after opening time.`;
      } else hours.push({ day: d.key, open, close });
    }
    if (!Object.keys(errors).some((k) => k.startsWith("hours."))) edit.hours = hours;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, edit };
}

const slotSchema = z.array(
  z.object({
    day: z.string(),
    open: z.string().regex(TIME),
    close: z.union([z.string().regex(TIME), z.literal("24:00")]),
  }),
);

function keptSlots(raw: FormDataEntryValue | null, day: DayOfWeek): HoursSlot[] | null {
  try {
    const parsed = slotSchema.safeParse(JSON.parse(String(raw ?? "")));
    if (!parsed.success || !parsed.data.length || parsed.data.some((s) => s.day !== day)) {
      return null;
    }
    return parsed.data.map((s) => ({ day, open: s.open, close: s.close }));
  } catch {
    return null;
  }
}

/** Drop fields that match what Google already has, so we only send real changes. */
export function changedOnly(edit: ListingEdit, current: GbpLocation): ListingEdit {
  const out: ListingEdit = {};
  // Compare the same number/address written differently ("0141 234…" vs "+91 141234…") as equal.
  const samePhone = (a: string | null, b: string | null) =>
    (a ? (normalisePhone(a) ?? a) : null) === (b ? (normalisePhone(b) ?? b) : null);
  const sameSite = (a: string | null, b: string | null) =>
    (a ? (normaliseWebsite(a) ?? a) : null) === (b ? (normaliseWebsite(b) ?? b) : null);
  if (edit.phone !== undefined && !samePhone(edit.phone, current.phone)) out.phone = edit.phone;
  if (edit.website !== undefined && !sameSite(edit.website, current.websiteUri)) {
    out.website = edit.website;
  }
  if (edit.description !== undefined && edit.description !== current.description) {
    out.description = edit.description;
  }
  if (edit.hours !== undefined) {
    const key = (h: HoursSlot[]) =>
      JSON.stringify([...h].sort((a, b) => `${a.day}${a.open}`.localeCompare(`${b.day}${b.open}`)));
    if (key(edit.hours) !== key(current.regularHours)) out.hours = edit.hours;
  }
  return out;
}

const time = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return minutes ? { hours, minutes } : { hours };
};

/** The Business Information API request: update mask plus the partial Location body. */
export function toGooglePatch(edit: ListingEdit): {
  updateMask: string;
  body: Record<string, unknown>;
} {
  const mask: string[] = [];
  const body: Record<string, unknown> = {};
  if (edit.phone !== undefined) {
    mask.push("phoneNumbers.primaryPhone");
    body.phoneNumbers = { primaryPhone: edit.phone ?? "" };
  }
  if (edit.website !== undefined) {
    mask.push("websiteUri");
    body.websiteUri = edit.website ?? "";
  }
  if (edit.description !== undefined) {
    mask.push("profile.description");
    body.profile = { description: edit.description ?? "" };
  }
  if (edit.hours !== undefined) {
    mask.push("regularHours");
    body.regularHours = {
      periods: edit.hours.map((h) =>
        h.open === "00:00" && h.close === "24:00"
          ? { openDay: h.day, openTime: {}, closeDay: h.day, closeTime: { hours: 24 } }
          : { openDay: h.day, openTime: time(h.open), closeDay: h.day, closeTime: time(h.close) },
      ),
    };
  }
  return { updateMask: mask.join(","), body };
}

/** The stored profile after an edit, so the app shows the change straight away. */
export function applyEdit(profile: GbpLocation, edit: ListingEdit): GbpLocation {
  return {
    ...profile,
    ...(edit.phone !== undefined ? { phone: edit.phone } : {}),
    ...(edit.website !== undefined ? { websiteUri: edit.website } : {}),
    ...(edit.description !== undefined ? { description: edit.description } : {}),
    ...(edit.hours !== undefined ? { regularHours: edit.hours } : {}),
  };
}

/** Plain words for notifications: "phone, opening hours". */
export function describeEdit(edit: ListingEdit): string {
  const parts: string[] = [];
  if (edit.phone !== undefined) parts.push("phone");
  if (edit.website !== undefined) parts.push("website");
  if (edit.description !== undefined) parts.push("description");
  if (edit.hours !== undefined) parts.push("opening hours");
  return parts.join(", ");
}

export const PHOTO_CATEGORIES = [
  { value: "EXTERIOR", label: "Outside" },
  { value: "INTERIOR", label: "Inside" },
  { value: "PRODUCT", label: "Products" },
  { value: "AT_WORK", label: "At work" },
  { value: "TEAM", label: "Team" },
  { value: "ADDITIONAL", label: "Other" },
] as const;

export const photoCategorySchema = z.enum(
  PHOTO_CATEGORIES.map((c) => c.value) as [string, ...string[]],
);
