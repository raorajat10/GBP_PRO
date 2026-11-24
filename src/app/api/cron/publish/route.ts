import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { publishDuePosts } from "@/lib/posts/publish";

/**
 * Publishes approved posts whose time has come. Called with
 * "Authorization: Bearer $CRON_SECRET" by Vercel Cron (vercel.json) and, for timely
 * publishing on the Hobby plan, by an external scheduler every 10 minutes.
 */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const outcomes = await publishDuePosts();
  const count = (r: string) => outcomes.filter((o) => o.result === r).length;
  return Response.json({
    published: count("published"),
    retrying: count("retry"),
    failed: count("failed"),
  });
}

// Publishing can take a while for several posts with photos.
export const maxDuration = 60;
