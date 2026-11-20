import { describe, expect, it } from "vitest";
import { tidyOwnWords } from "@/lib/reviews/tidy";
import { googleReviewLinkSchema } from "@/lib/clients/schema";

describe("google review link", () => {
  it.each([
    "https://g.page/r/CRwrOajZ1y_vEBM/review",
    "https://g.page/r/CRwrOajZ1y_vEBM",
    "https://search.google.com/local/writereview?placeid=ChIJ3cZEGsjJbTkRHCs5qNnXL-8",
  ])("accepts %s", (link) => {
    expect(googleReviewLinkSchema.parse(link)).toBe(link);
  });

  it("blank clears it", () => {
    expect(googleReviewLinkSchema.parse("  ")).toBeNull();
  });

  it.each([
    "http://g.page/r/abc/review",
    "https://evil.example/g.page/r/abc",
    "https://g.page/r/abc/review?next=https://evil.example",
    "javascript:alert(1)",
  ])("rejects %s", (link) => {
    expect(googleReviewLinkSchema.safeParse(link).success).toBe(false);
  });
});

describe("tidyOwnWords (no-AI fallback)", () => {
  it("only fixes spacing, capitals and the final full stop", () => {
    expect(tidyOwnWords("  installed 3kw panels.   team came on time ")).toBe(
      "Installed 3kw panels. Team came on time.",
    );
  });

  it("adds no words", () => {
    const notes = "meter took two weeks. otherwise ok";
    const words = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z ]/g, "")
        .split(/\s+/);
    expect(words(tidyOwnWords(notes))).toEqual(words(notes));
  });
});
