import { describe, expect, it } from "vitest";
import { AUTO_REPLY_BATCH, reviewsToAutoReply } from "@/lib/reviews/auto-reply-rules";

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
