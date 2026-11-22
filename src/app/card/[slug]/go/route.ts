import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import {
  CARD_EVENT_KINDS,
  getPublicCard,
  logCardEvent,
  type CardEventKind,
} from "@/lib/owner/card";
import { reviewPageUrl } from "@/lib/owner/links";
import { allowPublicRequest } from "@/lib/rate-limit";

/**
 * Card buttons go through here so the owner can see taps: /card/<slug>/go?to=call.
 * Only known destinations built from the business's own public profile — never a URL
 * from the query string, so this can't be used as an open redirect.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/card/[slug]/go">) {
  const { slug } = await ctx.params;
  const to = req.nextUrl.searchParams.get("to") as CardEventKind | null;
  const card = await getPublicCard(slug);
  if (!card || !to || !CARD_EVENT_KINDS.includes(to) || to === "view") {
    return NextResponse.redirect(new URL(`/card/${encodeURIComponent(slug)}`, req.url));
  }

  const target =
    to === "call" && card.phone
      ? `tel:${card.phone.replace(/[^\d+]/g, "")}`
      : to === "whatsapp" && card.whatsapp
        ? `https://wa.me/${card.whatsapp}`
        : to === "directions"
          ? card.directions
          : to === "website" && card.website?.startsWith("http")
            ? card.website
            : to === "review"
              ? reviewPageUrl(serverEnv().APP_URL, card.slug)
              : null;
  if (!target) return NextResponse.redirect(new URL(`/card/${encodeURIComponent(slug)}`, req.url));

  if (await allowPublicRequest(`card:${card.slug}:${to}`, { max: 20, windowMs: 60 * 60_000 })) {
    await logCardEvent(card.clientId, to);
  }
  return NextResponse.redirect(target, 302);
}

/** Page views, sent once by the card page itself. */
export async function POST(_: NextRequest, ctx: RouteContext<"/card/[slug]/go">) {
  const { slug } = await ctx.params;
  const card = await getPublicCard(slug);
  if (
    card &&
    (await allowPublicRequest(`card:${card.slug}:view`, { max: 10, windowMs: 60 * 60_000 }))
  ) {
    await logCardEvent(card.clientId, "view");
  }
  return new NextResponse(null, { status: 204 });
}
