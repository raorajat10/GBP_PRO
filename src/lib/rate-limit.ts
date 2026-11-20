import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort per-visitor limit for public pages (no login). In-memory, so it only
 * counts within one server instance — enough to stop casual abuse; swap for a shared
 * store if a public page gets real traffic.
 */
const buckets = new Map<string, number[]>();

export async function allowPublicRequest(
  scope: string,
  { max, windowMs }: { max: number; windowMs: number },
) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear();
  return true;
}
