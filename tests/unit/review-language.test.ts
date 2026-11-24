import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/auth/paths";
import { replyLanguage } from "@/lib/reviews/language";
import { firstName, thankYouReplies } from "@/lib/reviews/thank-you";

describe("replyLanguage", () => {
  it("answers Devanagari reviews in Hindi", () => {
    expect(replyLanguage("बहुत अच्छा काम किया, धन्यवाद", "en")).toBe("hi");
  });

  it("answers Roman-script Hindi in Hinglish", () => {
    expect(replyLanguage("Bahut accha kaam kiya team ne", "en")).toBe("hinglish");
    expect(replyLanguage("ekdum badhiya", "en")).toBe("hinglish");
  });

  it("answers English in English, even if the business prefers Hindi", () => {
    expect(replyLanguage("Great installation, very professional team.", "hi")).toBe("en");
  });

  it("uses the business's language for rating-only reviews", () => {
    expect(replyLanguage(null, "hi")).toBe("hi");
    expect(replyLanguage("   ", "hinglish")).toBe("hinglish");
  });

  it("keeps the review inbox behind sign-in", () => {
    expect(isProtectedPath("/reviews")).toBe(true);
  });
});

describe("thankYouReplies", () => {
  const base = { reviewer: "Asha Verma", business: "Sarvatra Energy" };

  it("thanks happy reviewers by first name, naming the business", () => {
    const [first] = thankYouReplies({ ...base, stars: 5, language: "en" });
    expect(first.text).toBe(
      "Thank you, Asha, for the wonderful review! We're glad you chose Sarvatra Energy and look forward to serving you again.",
    );
  });

  it("says sorry on 3 stars or fewer", () => {
    const options = thankYouReplies({ ...base, stars: 2, language: "en" });
    expect(options[0].text).toMatch(/We're sorry/);
    expect(options.every((o) => o.text.includes("Sarvatra Energy"))).toBe(true);
  });

  it("writes in Hindi and Hinglish", () => {
    expect(thankYouReplies({ ...base, stars: 5, language: "hi" })[0].text).toMatch(
      /^Asha जी, .*धन्यवाद/,
    );
    expect(thankYouReplies({ ...base, stars: 5, language: "hinglish" })[0].text).toMatch(
      /^Asha ji, .*dhanyawad/,
    );
  });

  it("leaves the name out for anonymous reviewers", () => {
    expect(firstName("A Google user")).toBeNull();
    expect(
      thankYouReplies({ reviewer: "A Google user", stars: 5, business: "X", language: "en" })[0]
        .text,
    ).toMatch(/^Thank you for the wonderful review!/);
  });
});
