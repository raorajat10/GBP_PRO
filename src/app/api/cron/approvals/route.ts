import { timingSafeEqual } from "node:crypto";
import { expireAndRemind } from "@/lib/approvals/service";
import { serverEnv } from "@/lib/env";

/**
 * Expires approval requests older than 72 h and sends 24 h reminders.
 * Vercel Cron calls this (see vercel.json) with "Authorization: Bearer $CRON_SECRET".
 * Answers after the deadline are refused anyway, so a late run never lets one through.
 */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await expireAndRemind();
  return Response.json(result);
}
