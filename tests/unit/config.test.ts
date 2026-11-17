import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { AI_TASKS, getAiTaskConfig } from "@/config/ai";
import { parseServerEnv } from "@/lib/env";

describe("brand", () => {
  it("uses the placeholder product name, not the parent company", () => {
    expect(brand.name).toBe("GBP Pro");
    expect(brand.name.toLowerCase()).not.toContain("sarvatra");
  });
});

describe("AI model per task", () => {
  it("defaults to the approved split: Sonnet for posts/replies, Opus for the audit", () => {
    expect(getAiTaskConfig("posts", {}).model).toBe("claude-sonnet-5-5");
    expect(getAiTaskConfig("reviewReplies", {}).model).toBe("claude-sonnet-5-5");
    expect(getAiTaskConfig("audit", {}).model).toBe("claude-opus-5-5");
    expect(getAiTaskConfig("reportSummary", {}).model).toBe("claude-sonnet-5-5");
  });

  it("can be overridden per task by env var without touching other tasks", () => {
    const env = { AI_MODEL_POSTS: "claude-opus-5-5" };
    expect(getAiTaskConfig("posts", env).model).toBe("claude-opus-5-5");
    expect(getAiTaskConfig("reviewReplies", env).model).toBe("claude-sonnet-5-5");
  });

  it("rejects unknown model names loudly", () => {
    expect(() => getAiTaskConfig("audit", { AI_MODEL_AUDIT: "gpt-whatever" })).toThrow(
      /not an allowed model/,
    );
  });

  it("has a config for every task", () => {
    for (const task of AI_TASKS) expect(getAiTaskConfig(task, {}).maxTokens).toBeGreaterThan(0);
  });
});

describe("server env", () => {
  it("defaults both providers to mock so nothing real is called by accident", () => {
    const env = parseServerEnv({});
    expect(env.GBP_PROVIDER).toBe("mock");
    expect(env.MESSAGING_PROVIDER).toBe("mock");
  });

  it("rejects an invalid provider value", () => {
    expect(() => parseServerEnv({ GBP_PROVIDER: "scraper" })).toThrow(/GBP_PROVIDER/);
  });
});
