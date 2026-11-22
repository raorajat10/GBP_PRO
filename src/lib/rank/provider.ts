import "server-only";
import { serverEnv } from "@/lib/env";
import type { LatLng, PlaceResult } from "./grid";

/**
 * Where grid-ranking searches come from. "mock" gives believable sample results for free;
 * "google" uses Places API (New) Text Search, which Google bills per request — one request
 * per grid point. Both return the same shapes, so the rest of the app doesn't care.
 */
export interface RankProvider {
  readonly kind: "mock" | "google";
  /** Where the business is, from its Google place ID (or a sample location). */
  locate(place: { placeId: string | null; title: string }): Promise<LatLng>;
  /** Up to 20 businesses Google shows for this search near this point, in order. */
  search(input: { keyword: string; at: LatLng; biasRadiusM: number }): Promise<PlaceResult[]>;
}

export class RankError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "quota" | "not_found" | "upstream" = "upstream",
  ) {
    super(message);
    this.name = "RankError";
  }
}

export function getRankProvider(): RankProvider {
  const env = serverEnv();
  if (env.RANK_PROVIDER === "google") {
    if (!env.GOOGLE_PLACES_API_KEY) {
      throw new RankError(
        "Grid ranking is set to Google but GOOGLE_PLACES_API_KEY is missing.",
        "config",
      );
    }
    return new GooglePlacesRankProvider(env.GOOGLE_PLACES_API_KEY);
  }
  return new MockRankProvider();
}

// ───────────────────────────── Google Places API (New) ─────────────────────────────

const PLACES = "https://places.googleapis.com/v1";
// Pro-tier fields only (no rating), so each search is billed at the Text Search Pro rate.
const SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress";

class GooglePlacesRankProvider implements RankProvider {
  readonly kind = "google" as const;
  constructor(private readonly key: string) {}

  private async call(path: string, init: RequestInit, fieldMask: string) {
    const res = await fetch(`${PLACES}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.key,
        "X-Goog-FieldMask": fieldMask,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429)
      throw new RankError("Google's search limit was reached. Try again later.", "quota");
    if (res.status === 404) throw new RankError("Google couldn't find this business.", "not_found");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Places API error", res.status, body.slice(0, 500));
      throw new RankError("Google's search didn't respond as expected. Try again later.");
    }
    return res.json();
  }

  async locate(place: { placeId: string | null; title: string }): Promise<LatLng> {
    if (!place.placeId || place.placeId.startsWith("SAMPLE_")) {
      throw new RankError(
        "This profile has no real Google place ID yet, so it can't be scanned on Google.",
        "not_found",
      );
    }
    // Place Details with only "location" is billed at the Essentials rate.
    const data = (await this.call(
      `/places/${encodeURIComponent(place.placeId)}`,
      { method: "GET" },
      "location",
    )) as { location?: { latitude: number; longitude: number } };
    if (!data.location)
      throw new RankError("Google has no map position for this business.", "not_found");
    return { lat: data.location.latitude, lng: data.location.longitude };
  }

  async search(input: {
    keyword: string;
    at: LatLng;
    biasRadiusM: number;
  }): Promise<PlaceResult[]> {
    const data = (await this.call(
      "/places:searchText",
      {
        method: "POST",
        body: JSON.stringify({
          textQuery: input.keyword,
          pageSize: 20,
          languageCode: "en",
          regionCode: "IN",
          locationBias: {
            circle: {
              center: { latitude: input.at.lat, longitude: input.at.lng },
              radius: Math.min(50_000, input.biasRadiusM),
            },
          },
        }),
      },
      SEARCH_FIELDS,
    )) as {
      places?: { id: string; displayName?: { text?: string }; formattedAddress?: string }[];
    };
    return (data.places ?? []).map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Unnamed business",
      address: p.formattedAddress ?? null,
    }));
  }
}

// ───────────────────────────── Sample data ─────────────────────────────

/** Deterministic pseudo-random numbers from a string seed. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const SAMPLE_NAMES = [
  "Suryoday Solar Solutions",
  "Pink City Power Systems",
  "Aravali Green Energy",
  "Rajputana Rooftop Solar",
  "Hawa Mahal Electricals",
  "Shree Ganesh Solar Point",
  "Jaipur Sun Tech",
  "Bright Future Renewables",
  "Malviya Nagar Solar Hub",
  "Desert Sun Installers",
  "Amber Energy Works",
  "Vaishali Solar Care",
  "Mansarovar Power House",
  "Nahargarh Solar & Inverters",
  "Sitapura Energy Systems",
];

/** Sample results: the business ranks well near itself and fades with distance. */
class MockRankProvider implements RankProvider {
  readonly kind = "mock" as const;
  private center = new Map<string, LatLng>();

  async locate(place: { placeId: string | null; title: string }): Promise<LatLng> {
    const r = rng(place.placeId ?? place.title);
    // Somewhere in Jaipur.
    const at = { lat: 26.85 + r() * 0.12, lng: 75.72 + r() * 0.12 };
    this.center.set(place.placeId ?? place.title, at);
    return at;
  }

  async search(input: {
    keyword: string;
    at: LatLng;
    biasRadiusM: number;
  }): Promise<PlaceResult[]> {
    const r = rng(
      `${input.keyword.toLowerCase()}:${input.at.lat.toFixed(4)}:${input.at.lng.toFixed(4)}`,
    );
    const pool = SAMPLE_NAMES.map((name, i) => ({
      placeId: `SAMPLE_COMP_${i + 1}`,
      name,
      address: "Jaipur, Rajasthan",
      score: r() + (i < 4 ? 0.35 : 0), // a few strong local competitors
    }));
    return pool
      .sort((a, b) => b.score - a.score)
      .map(({ placeId, name, address }) => ({ placeId, name, address }));
  }

  /** The service inserts the business itself into sample results by distance (see service.ts). */
  static sampleRank(distanceKm: number, radiusKm: number, seed: string): number | null {
    const r = rng(seed)();
    const spread = distanceKm / Math.max(radiusKm, 0.1); // 0 at centre … ~1.4 at corners
    const rank = Math.round(1 + spread * 9 + r * 4);
    return rank > 20 || r < spread * 0.25 ? null : rank;
  }
}

export const sampleRank = MockRankProvider.sampleRank;
