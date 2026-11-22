/**
 * Grid ranking maths. Pure: no network, no database, so it is unit-tested directly.
 *
 * A scan searches one keyword from every point of a square grid centred on the business
 * and records the business's position in the results at each point (1–20, or null when it
 * isn't in the top 20).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GridPoint extends LatLng {
  row: number;
  col: number;
}

export const GRID_SIZES = [3, 5, 7] as const;
export type GridSize = (typeof GRID_SIZES)[number];

/** Position used for "not in the top 20" when averaging (Average Rank Position). */
export const NOT_FOUND_RANK = 21;
export const MAX_RANK = 20;

const KM_PER_DEG_LAT = 111.32;

/**
 * size×size points evenly spread over a square reaching radiusKm from the centre in each
 * direction (row 0 = north, col 0 = west). A 1-point grid would be just the centre.
 */
export function gridPoints(center: LatLng, size: GridSize, radiusKm: number): GridPoint[] {
  const step = size > 1 ? (2 * radiusKm) / (size - 1) : 0;
  const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
  const half = (size - 1) / 2;
  const points: GridPoint[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const northKm = (half - row) * step;
      const eastKm = (col - half) * step;
      points.push({
        row,
        col,
        lat: round6(center.lat + northKm / KM_PER_DEG_LAT),
        lng: round6(center.lng + eastKm / kmPerDegLng),
      });
    }
  }
  return points;
}

/** How tightly each point's search is centred: half the gap between points, at least 500 m. */
export function biasRadiusMeters(size: GridSize, radiusKm: number): number {
  const stepKm = size > 1 ? (2 * radiusKm) / (size - 1) : radiusKm;
  return Math.max(500, Math.round((stepKm * 1000) / 2));
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ScanSummary {
  points: number;
  foundPoints: number;
  top3Points: number;
  /** Average position where the business was found; null if found nowhere. */
  avgRank: number | null;
  /** Average Rank Position across all points, "not found" counted as 21. */
  arp: number;
  bestRank: number | null;
  worstRank: number | null;
  /** Share of points where the business appears at all, 0..1. */
  visibility: number;
}

export function summarizeScan(ranks: (number | null)[]): ScanSummary {
  const found = ranks.filter((r): r is number => r != null);
  const points = ranks.length;
  return {
    points,
    foundPoints: found.length,
    top3Points: found.filter((r) => r <= 3).length,
    avgRank: found.length ? round2(found.reduce((a, b) => a + b, 0) / found.length) : null,
    arp: points
      ? round2(ranks.reduce<number>((a, r) => a + (r ?? NOT_FOUND_RANK), 0) / points)
      : NOT_FOUND_RANK,
    bestRank: found.length ? Math.min(...found) : null,
    worstRank: found.length ? Math.max(...found) : null,
    visibility: points ? found.length / points : 0,
  };
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
}

export interface CompetitorRow {
  placeId: string;
  name: string;
  address: string | null;
  /** Points where they appear in the top 20. */
  appearances: number;
  /** Points where they're in the top 3 (the map pack). */
  top3: number;
  avgRank: number;
  /** appearances ÷ points scanned, 0..1 */
  visibility: number;
  /** Points where they rank above the business (or appear where the business doesn't). */
  aheadOfYou: number;
  keywords: string[];
  isYou: boolean;
}

/**
 * Everyone who showed up across the given scans' grid points, ranked by how often they
 * appear (then by average position). The business itself is included and flagged.
 */
export function competitorsFrom(
  scans: { keyword: string; points: { rank: number | null; results: PlaceResult[] }[] }[],
  yourPlaceId: string | null,
): { rows: CompetitorRow[]; pointsScanned: number } {
  const byPlace = new Map<
    string,
    { name: string; address: string | null; ranks: number[]; ahead: number; keywords: Set<string> }
  >();
  let pointsScanned = 0;
  for (const scan of scans) {
    for (const p of scan.points) {
      pointsScanned++;
      p.results.slice(0, MAX_RANK).forEach((r, i) => {
        const rank = i + 1;
        const e = byPlace.get(r.placeId) ?? {
          name: r.name,
          address: r.address,
          ranks: [],
          ahead: 0,
          keywords: new Set<string>(),
        };
        e.ranks.push(rank);
        e.keywords.add(scan.keyword);
        if (r.placeId !== yourPlaceId && (p.rank == null || rank < p.rank)) e.ahead++;
        byPlace.set(r.placeId, e);
      });
    }
  }
  const rows: CompetitorRow[] = [...byPlace.entries()].map(([placeId, e]) => ({
    placeId,
    name: e.name,
    address: e.address,
    appearances: e.ranks.length,
    top3: e.ranks.filter((r) => r <= 3).length,
    avgRank: round2(e.ranks.reduce((a, b) => a + b, 0) / e.ranks.length),
    visibility: pointsScanned ? e.ranks.length / pointsScanned : 0,
    aheadOfYou: e.ahead,
    keywords: [...e.keywords],
    isYou: placeId === yourPlaceId,
  }));
  rows.sort((a, b) => b.appearances - a.appearances || a.avgRank - b.avgRank);
  return { rows, pointsScanned };
}

/** First day of the month in India time, as an ISO timestamp, for the monthly scan limit. */
export function monthStartIst(now: Date): string {
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  return new Date(`${ym}-01T00:00:00+05:30`).toISOString();
}

/**
 * Google's free monthly allowance resets at midnight US Pacific time on the 1st, so the
 * service-wide cap counts from then (ISO timestamp).
 */
export function monthStartPacific(now: Date): string {
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  // Midnight Pacific is 08:00 UTC in winter (PST) and 07:00 UTC in summer (PDT).
  for (const utcHour of ["08", "07"]) {
    const t = new Date(`${ym}-01T${utcHour}:00:00Z`);
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(t);
    if (hour === "00") return t.toISOString();
  }
  return new Date(`${ym}-01T08:00:00Z`).toISOString();
}

/**
 * Searches we allow ourselves per month: 90% of Google's free amount, so retries, failed
 * scans and clock differences can never push the bill above zero.
 */
export function safeMonthlySearches(freePerMonth: number): number {
  return Math.floor(freePerMonth * 0.9);
}

/** How many scans of a given grid size fit in a number of grid points. */
export const scansThatFit = (points: number, size: number) => Math.floor(points / (size * size));

/** Tailwind classes for a rank cell: green for the map pack, amber mid-page, red low or absent. */
export function rankTone(rank: number | null): "top" | "mid" | "low" | "none" {
  if (rank == null) return "none";
  if (rank <= 3) return "top";
  if (rank <= 10) return "mid";
  return "low";
}
