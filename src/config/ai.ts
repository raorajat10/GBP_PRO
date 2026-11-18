/**
 * Claude model per task. Defaults are the approved plan:
 * posts and review replies on Sonnet 5.5, profile audit on Opus 5.5.
 * Each task can be overridden with an env var (e.g. AI_MODEL_POSTS=claude-opus-5-5)
 * without a code change.
 */
export const AI_TASKS = ["posts", "reviewReplies", "audit", "reportSummary"] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const ALLOWED_MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"] as const;
export type AiModel = (typeof ALLOWED_MODELS)[number];

export type AiEffort = "low" | "medium" | "high";

export interface AiTaskConfig {
  model: AiModel;
  effort: AiEffort;
  maxTokens: number;
}

const DEFAULTS: Record<AiTask, AiTaskConfig> = {
  posts: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 16000 },
  reviewReplies: { model: "claude-sonnet-5-5", effort: "low", maxTokens: 2000 },
  // A ceiling, not a target: thinking counts towards it, so leave headroom to avoid cut-offs.
  audit: { model: "claude-opus-5-5", effort: "medium", maxTokens: 16000 },
  reportSummary: { model: "claude-sonnet-5-5", effort: "low", maxTokens: 1500 },
};

const ENV_KEYS: Record<AiTask, string> = {
  posts: "AI_MODEL_POSTS",
  reviewReplies: "AI_MODEL_REVIEW_REPLIES",
  audit: "AI_MODEL_AUDIT",
  reportSummary: "AI_MODEL_REPORT_SUMMARY",
};

function isAllowedModel(value: string): value is AiModel {
  return (ALLOWED_MODELS as readonly string[]).includes(value);
}

/** Resolve the config for a task. Unknown override values fail loudly instead of silently. */
export function getAiTaskConfig(
  task: AiTask,
  env: Record<string, string | undefined> = process.env,
): AiTaskConfig {
  const base = DEFAULTS[task];
  const override = env[ENV_KEYS[task]]?.trim();
  if (!override) return base;
  if (!isAllowedModel(override)) {
    throw new Error(
      `${ENV_KEYS[task]}="${override}" is not an allowed model. Use one of: ${ALLOWED_MODELS.join(", ")}`,
    );
  }
  return { ...base, model: override };
}
