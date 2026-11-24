import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { syncDueLocations } from "@/lib/gbp/sync-all";

/**
 * Daily refresh of every linked Google profile (new reviews, photos, posts, numbers and
 * the score). Vercel Cron calls it once a day with "Authorization: Bearer $CRON_SECRET";
 * an external scheduler may call it more often to work through many clients.
 */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await syncDueLocations());
}

// Syncing pages through every review; leave room beyond the 45 s work budget.
export const maxDuration = 60;
