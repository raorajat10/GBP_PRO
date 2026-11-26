import { describe, expect, it } from "vitest";
import {
  AUTO_REPLY_BATCH,
  backlogMessage,
  reviewsToAutoReply,
} from "@/lib/reviews/auto-reply-rules";

describe("backlogMessage", () => {
  it("says what happened and what's left", () => {
    expect(backlogMessage({ posted: 0, failed: 0, remaining: 0 })).toBe(
      "Every good review already has a reply.",
    );
    expect(backlogMessage({ posted: 1, failed: 0, remaining: 0 })).toBe(
      "Thanked 1 review on Google.",
    );
    expect(backlogMessage({ posted: 50, failed: 2, remaining: 12 })).toBe(
      "Thanked 50 reviews on Google. 2 couldn't be posted; try again later. 12 more left: press again to continue.",
    );
  });
});

const since = "2026-11-24T10:00:00Z";
const r = (id: string, stars: number, at: string, hasReply = false) => ({
  id,
  starRating: stars,
  reviewedAt: at,
  hasReply,
});

describe("reviewsToAutoReply", () => {
  it("answers only new, unanswered reviews at or above the star level, oldest first", () => {
    const due = reviewsToAutoReply(
      [
        r("new5", 5, "2026-11-24T12:00:00Z"),
        r("new4", 4, "2026-11-24T11:00:00Z"),
        r("new3", 3, "2026-11-24T11:30:00Z"),
        r("old5", 5, "2026-11-23T09:00:00Z"),
        r("answered", 5, "2026-11-24T12:30:00Z", true),
      ],
      { since, minStars: 4 },
    );
    expect(due.map((d) => d.id)).toEqual(["new4", "new5"]);
  });

  it("does nothing when switched off", () => {
    expect(
      reviewsToAutoReply([r("a", 5, "2026-11-24T12:00:00Z")], { since: null, minStars: 4 }),
    ).toEqual([]);
  });

  it("caps one run so a burst of reviews is spread out", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      r(`x${i}`, 5, `2026-11-24T12:${String(i).padStart(2, "0")}:00Z`),
    );
    expect(reviewsToAutoReply(many, { since, minStars: 4 })).toHaveLength(AUTO_REPLY_BATCH);
  });
});
