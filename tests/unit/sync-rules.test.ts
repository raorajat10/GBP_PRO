import { describe, expect, it } from "vitest";
import { dueForSync, type SyncCandidate } from "@/lib/gbp/sync-rules";

const now = new Date("2026-11-24T22:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const loc = (id: string, h: number, extra: Partial<SyncCandidate> = {}): SyncCandidate => ({
  id,
  syncedAt: hoursAgo(h),
  connectionStatus: "connected",
  clientStatus: "active",
  ...extra,
});

describe("dueForSync", () => {
  it("picks profiles not synced in the last 20 hours, oldest first", () => {
    const due = dueForSync([loc("a", 21), loc("b", 5), loc("c", 72), loc("d", 20.5)], now);
    expect(due.map((d) => d.id)).toEqual(["c", "a", "d"]);
  });

  it("skips paused clients and broken Google connections", () => {
    const due = dueForSync(
      [
        loc("paused", 48, { clientStatus: "paused" }),
        loc("broken", 48, { connectionStatus: "error" }),
        loc("ok", 48),
      ],
      now,
    );
    expect(due.map((d) => d.id)).toEqual(["ok"]);
  });
});
