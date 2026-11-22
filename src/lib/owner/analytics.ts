/** Range maths for the owner's Analytics page and monthly reports. Pure, unit-tested. */

export interface MetricDay {
  day: string; // YYYY-MM-DD
  impressions_search: number;
  impressions_maps: number;
  calls: number;
  direction_requests: number;
  website_clicks: number;
}

export interface Totals {
  views: number;
  search: number;
  maps: number;
  calls: number;
  directions: number;
  website: number;
  actions: number;
  /** actions ÷ views, 0..1; null with no views */
  engagement: number | null;
}

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export function parseRange(v: unknown): RangeDays {
  const n = Number(v);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

export function totalsOf(days: MetricDay[]): Totals {
  const t = { search: 0, maps: 0, calls: 0, directions: 0, website: 0 };
  for (const d of days) {
    t.search += d.impressions_search;
    t.maps += d.impressions_maps;
    t.calls += d.calls;
    t.directions += d.direction_requests;
    t.website += d.website_clicks;
  }
  const views = t.search + t.maps;
  const actions = t.calls + t.directions + t.website;
  return { ...t, views, actions, engagement: views ? actions / views : null };
}

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Split stored days into the chosen range (ending on the latest day we have) and the
 * same-length period before it, for the "vs previous" comparison. Missing days count as 0.
 */
export function splitRange(
  all: MetricDay[],
  range: RangeDays,
): { current: MetricDay[]; previous: MetricDay[] | null; dates: string[] } {
  if (!all.length) return { current: [], previous: null, dates: [] };
  const byDay = new Map(all.map((d) => [d.day, d]));
  const last = all.reduce((m, d) => (d.day > m ? d.day : m), all[0].day);
  const first = all.reduce((m, d) => (d.day < m ? d.day : m), all[0].day);
  const zero = (day: string): MetricDay => ({
    day,
    impressions_search: 0,
    impressions_maps: 0,
    calls: 0,
    direction_requests: 0,
    website_clicks: 0,
  });
  const dates = Array.from({ length: range }, (_, i) => addDays(last, i - range + 1)).filter(
    (d) => d >= first,
  );
  const current = dates.map((d) => byDay.get(d) ?? zero(d));
  const prevStart = addDays(last, -2 * range + 1);
  const previous =
    prevStart >= first
      ? Array.from({ length: range }, (_, i) => addDays(prevStart, i)).map(
          (d) => byDay.get(d) ?? zero(d),
        )
      : null;
  return { current, previous, dates };
}

/** Percent change, rounded; null when there is nothing to compare with. */
export function change(now: number, before: number | null | undefined): number | null {
  if (before == null || before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}
