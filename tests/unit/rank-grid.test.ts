import { describe, expect, it } from "vitest";
import {
  biasRadiusMeters,
  competitorsFrom,
  gridPoints,
  monthStartIst,
  monthStartPacific,
  safeMonthlySearches,
  scansThatFit,
  rankTone,
  summarizeScan,
} from "@/lib/rank/grid";

const jaipur = { lat: 26.9124, lng: 75.7873 };

describe("gridPoints", () => {
  it("makes size² points with the business at the centre", () => {
    const pts = gridPoints(jaipur, 5, 5);
    expect(pts).toHaveLength(25);
    const centre = pts.find((p) => p.row === 2 && p.col === 2)!;
    expect(centre.lat).toBeCloseTo(jaipur.lat, 6);
    expect(centre.lng).toBeCloseTo(jaipur.lng, 6);
  });

  it("puts north at the top and east on the right, radius km away", () => {
    const pts = gridPoints(jaipur, 3, 5);
    const nw = pts.find((p) => p.row === 0 && p.col === 0)!;
    const se = pts.find((p) => p.row === 2 && p.col === 2)!;
    expect(nw.lat).toBeGreaterThan(jaipur.lat);
    expect(nw.lng).toBeLessThan(jaipur.lng);
    expect(se.lat).toBeLessThan(jaipur.lat);
    expect(se.lng).toBeGreaterThan(jaipur.lng);
    // 5 km north ≈ 0.0449° of latitude
    expect(nw.lat - jaipur.lat).toBeCloseTo(5 / 111.32, 4);
  });

  it("biases each search to about half the gap between points, never under 500 m", () => {
    expect(biasRadiusMeters(5, 5)).toBe(1250);
    expect(biasRadiusMeters(7, 0.5)).toBe(500);
  });
});

describe("summarizeScan", () => {
  it("averages found ranks, counts not-found as 21 for ARP", () => {
    const s = summarizeScan([1, 2, 5, null]);
    expect(s).toEqual({
      points: 4,
      foundPoints: 3,
      top3Points: 2,
      avgRank: 2.67,
      arp: 7.25, // (1+2+5+21)/4
      bestRank: 1,
      worstRank: 5,
      visibility: 0.75,
    });
  });

  it("handles a business found nowhere", () => {
    const s = summarizeScan([null, null]);
    expect(s.avgRank).toBeNull();
    expect(s.arp).toBe(21);
    expect(s.visibility).toBe(0);
  });
});

describe("competitorsFrom", () => {
  const A = { placeId: "A", name: "Alpha", address: null };
  const B = { placeId: "B", name: "Beta", address: "x" };
  const ME = { placeId: "ME", name: "Me", address: null };

  it("ranks businesses by how often they appear and flags you", () => {
    const { rows, pointsScanned } = competitorsFrom(
      [
        {
          keyword: "solar",
          points: [
            { rank: 2, results: [A, ME, B] },
            { rank: null, results: [A, B] },
            { rank: 1, results: [ME, A] },
          ],
        },
      ],
      "ME",
    );
    expect(pointsScanned).toBe(3);
    expect(rows.map((r) => r.placeId)).toEqual(["A", "ME", "B"]);
    const a = rows[0];
    expect(a).toMatchObject({
      appearances: 3,
      top3: 3,
      avgRank: 1.33,
      aheadOfYou: 2,
      isYou: false,
    });
    expect(a.visibility).toBe(1);
    expect(rows[1].isYou).toBe(true);
    // B is behind you at point 1, ahead where you're missing (point 2).
    expect(rows[2].aheadOfYou).toBe(1);
  });

  it("merges keywords across scans", () => {
    const { rows } = competitorsFrom(
      [
        { keyword: "solar", points: [{ rank: null, results: [A] }] },
        { keyword: "inverter", points: [{ rank: null, results: [A] }] },
      ],
      "ME",
    );
    expect(rows[0].keywords).toEqual(["solar", "inverter"]);
  });
});

describe("free-tier limits", () => {
  it("counts Google's month from midnight US Pacific, winter and summer", () => {
    expect(monthStartPacific(new Date("2026-12-15T00:00:00Z"))).toBe("2026-12-01T08:00:00.000Z");
    expect(monthStartPacific(new Date("2026-07-15T00:00:00Z"))).toBe("2026-07-01T07:00:00.000Z");
    // 1 Dec 05:00 UTC is still 30 Nov in California.
    expect(monthStartPacific(new Date("2026-12-01T05:00:00Z"))).toBe("2026-11-01T07:00:00.000Z");
  });

  it("stays 10% under Google's free amount", () => {
    expect(safeMonthlySearches(5000)).toBe(4500);
    expect(safeMonthlySearches(35000)).toBe(31500);
    expect(safeMonthlySearches(0)).toBe(0);
  });

  it("turns grid points into whole scans", () => {
    expect(scansThatFit(100, 5)).toBe(4);
    expect(scansThatFit(100, 7)).toBe(2);
    expect(scansThatFit(4500, 5)).toBe(180);
    expect(scansThatFit(20, 5)).toBe(0);
  });
});

describe("helpers", () => {
  it("month start in India time", () => {
    // 1 Dec 2026, 02:00 IST is still 30 Nov in UTC.
    expect(monthStartIst(new Date("2026-11-30T20:30:00Z"))).toBe("2026-11-30T18:30:00.000Z");
    expect(monthStartIst(new Date("2026-11-15T10:00:00Z"))).toBe("2026-10-31T18:30:00.000Z");
  });

  it("rank colours", () => {
    expect([1, 3, 4, 10, 11, 20, null].map(rankTone)).toEqual([
      "top",
      "top",
      "mid",
      "mid",
      "low",
      "low",
      "none",
    ]);
  });
});
