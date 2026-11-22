/** Shared shapes for owner-portal forms (server actions can only export async functions). */

export interface OwnerFormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
}

export const CHANGE_AREAS = [
  { value: "info", label: "Business info" },
  { value: "hours", label: "Opening hours" },
  { value: "categories", label: "Categories" },
  { value: "attributes", label: "Attributes" },
  { value: "services", label: "Services" },
  { value: "photos", label: "Photos" },
  { value: "other", label: "Something else" },
] as const;

export type ChangeArea = (typeof CHANGE_AREAS)[number]["value"];

export const changeAreaLabel = (v: string) =>
  CHANGE_AREAS.find((a) => a.value === v)?.label ?? "Something else";

/** Lines for a change request built from attribute toggles: only what differs. */
export function attributeChangeLines(
  current: readonly string[],
  wanted: readonly string[],
  label: (key: string) => string,
): string[] {
  const had = new Set(current);
  const want = new Set(wanted);
  const add = [...want].filter((k) => !had.has(k)).map((k) => `Turn on: ${label(k)}`);
  const remove = [...had].filter((k) => !want.has(k)).map((k) => `Turn off: ${label(k)}`);
  return [...add, ...remove];
}
