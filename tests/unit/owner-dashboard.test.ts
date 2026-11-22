import { describe, expect, it } from "vitest";
import {
  breakdownRows,
  ownerTasks,
  scoreChange,
  teamWorkItems,
  type OwnerAuditItem,
} from "@/lib/owner/dashboard";

const item = (
  key: string,
  status: OwnerAuditItem["status"],
  rank: number,
  points = 0,
  pointsMax = 10,
): OwnerAuditItem => ({ key, title: key, status, rank, points, pointsMax });

describe("ownerTasks", () => {
  it("asks for approvals, reviews and photos when those need the owner", () => {
    const tasks = ownerTasks({
      items: [item("reviews", "fail", 1), item("photos", "warn", 2), item("hours", "fail", 3)],
      pendingApprovals: 2,
      reviewPageSlug: "sarvatra",
    });
    expect(tasks.map((t) => t.id)).toEqual(["approvals", "reviews", "photos"]);
    expect(tasks[0].title).toBe("Approve the 2 posts waiting for you");
    expect(tasks[1].action).toEqual({ kind: "share-review-page", slug: "sarvatra" });
  });

  it("uses the singular for one waiting post", () => {
    const [t] = ownerTasks({ items: [], pendingApprovals: 1, reviewPageSlug: null });
    expect(t.title).toBe("Approve the post waiting for you");
  });

  it("asks nothing when reviews and photos pass and nothing waits", () => {
    expect(
      ownerTasks({
        items: [item("reviews", "pass", 9, 10), item("photos", "pass", 10, 10)],
        pendingApprovals: 0,
        reviewPageSlug: "x",
      }),
    ).toEqual([]);
  });

  it("still suggests reviews before the first audit, but only with a review page", () => {
    expect(
      ownerTasks({ items: [], pendingApprovals: 0, reviewPageSlug: "x" }).map((t) => t.id),
    ).toEqual(["reviews"]);
    expect(ownerTasks({ items: [], pendingApprovals: 0, reviewPageSlug: null })).toEqual([]);
  });
});

describe("teamWorkItems", () => {
  it("keeps failing non-owner checks, best rank first, up to the limit", () => {
    const rows = teamWorkItems(
      [
        item("hours", "warn", 3),
        item("reviews", "fail", 1),
        item("description", "fail", 2),
        item("contact", "pass", 8, 10),
        item("services", "fail", 4),
      ],
      2,
    );
    expect(rows.map((r) => r.key)).toEqual(["description", "hours"]);
  });
});

describe("breakdownRows", () => {
  it("orders rows like the audit's check list, unknown keys last", () => {
    const rows = breakdownRows([
      item("zzz", "pass", 1),
      item("replies", "pass", 2),
      item("description", "fail", 3),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["description", "replies", "zzz"]);
  });
});

describe("scoreChange", () => {
  it("describes the move since the previous audit", () => {
    expect(scoreChange(83, 85)).toEqual({ delta: -2, label: "Down 2 pts since last check" });
    expect(scoreChange(80, 79)).toEqual({ delta: 1, label: "Up 1 pt since last check" });
    expect(scoreChange(70, 70)?.label).toBe("No change since last check");
    expect(scoreChange(70, null)).toBeNull();
  });
});
