import { describe, expect, it } from "vitest";
import { MAX_PUBLISH_ATTEMPTS, nextAttempt } from "@/lib/posts/publish-rules";

const now = new Date("2026-11-24T10:00:00Z");

describe("nextAttempt", () => {
  it("retries after 10 minutes, then an hour", () => {
    expect(nextAttempt({ attempts: 1, permanent: false, now })).toBe("2026-11-24T10:10:00.000Z");
    expect(nextAttempt({ attempts: 2, permanent: false, now })).toBe("2026-11-24T11:00:00.000Z");
  });

  it("gives up after the last try", () => {
    expect(nextAttempt({ attempts: MAX_PUBLISH_ATTEMPTS, permanent: false, now })).toBeNull();
  });

  it("never retries problems a retry can't fix", () => {
    expect(nextAttempt({ attempts: 1, permanent: true, now })).toBeNull();
  });
});
