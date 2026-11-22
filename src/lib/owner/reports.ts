/** Month helpers for monthly reports. Pure, unit-tested. */

/** "2026-11" for a date, in India time. */
export function monthKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  })
    .format(d)
    .slice(0, 7);
}

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + by;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** First and last calendar day of a month, YYYY-MM-DD. */
export function monthDays(key: string): { first: string; last: string } {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${key}-01`, last: `${key}-${String(last).padStart(2, "0")}` };
}

/** Months to list, newest first: from the current month back to the first month with data, max 12. */
export function reportMonths(now: Date, firstDataDay: string | null, max = 12): string[] {
  if (!firstDataDay) return [];
  const current = monthKey(now);
  const first = firstDataDay.slice(0, 7);
  const out: string[] = [];
  for (let k = current; k >= first && out.length < max; k = shiftMonth(k, -1)) out.push(k);
  return out;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}
