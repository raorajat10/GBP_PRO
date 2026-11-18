import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getAiTaskConfig, type AiTask } from "@/config/ai";
import { serverEnv } from "@/lib/env";
import { AUDIT_FIX_SYSTEM, auditFixUserMessage } from "./prompts/audit-fix";
import { POST_SYSTEM, postUserMessage } from "./prompts/post";
import { SampleWriter } from "./sample";
import {
  AiError,
  sanitizeAuditFixes,
  sanitizePostDrafts,
  type AiWriter,
  type AuditFixRequest,
  type AuditFixResult,
  type PostDraftRequest,
  type PostDraftResult,
} from "./writer";

const AuditFixOutput = z.object({
  fixes: z.array(z.object({ key: z.string(), text: z.string() })),
  suggestedDescription: z.string().nullable(),
});

const PostDraftOutput = z.object({
  drafts: z.array(z.object({ angle: z.string(), body: z.string() })),
});

/** AiWriter backed by the Anthropic API. Model and effort per task come from src/config/ai.ts. */
export class ClaudeWriter implements AiWriter {
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
    this.model = getAiTaskConfig("audit").model;
  }

  /** One structured-output call. Maps API failures to friendly AiErrors. */
  private async call<T extends z.ZodType>(
    task: AiTask,
    schema: T,
    system: string,
    content: Anthropic.Beta.BetaContentBlockParam[] | string,
    what: string,
  ): Promise<{ output: z.infer<T>; model: string }> {
    const cfg = getAiTaskConfig(task);
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        output_config: { effort: cfg.effort, format: betaZodOutputFormat(schema) },
        // If the model declines for policy reasons, the API retries on its default fallback.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        throw new AiError(
          "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.",
          "not_configured",
        );
      }
      if (e instanceof Anthropic.RateLimitError) {
        throw new AiError("The AI service is busy. Try again in a minute.", "rate_limited");
      }
      if (e instanceof Anthropic.APIError) {
        throw new AiError(
          `The AI service returned an error (${e.status ?? "network"}).`,
          "unknown",
        );
      }
      throw e;
    }

    if (response.stop_reason === "refusal") {
      throw new AiError(`The AI declined to write ${what}.`, "refused");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new AiError("The AI's answer was incomplete. Try again.", "invalid_output");
    }
    return { output: response.parsed_output as z.infer<T>, model: response.model };
  }

  async writeAuditFixes(input: AuditFixRequest): Promise<AuditFixResult> {
    const { output, model } = await this.call(
      "audit",
      AuditFixOutput,
      AUDIT_FIX_SYSTEM,
      auditFixUserMessage(input),
      "these fixes. The standard fixes are shown",
    );
    return sanitizeAuditFixes(input, output, model);
  }

  async writePostDrafts(input: PostDraftRequest): Promise<PostDraftResult> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (input.photo) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: input.photo.mediaType, data: input.photo.base64 },
      });
    }
    content.push({ type: "text", text: postUserMessage(input) });
    const { output, model } = await this.call(
      "posts",
      PostDraftOutput,
      POST_SYSTEM,
      content,
      "this post. Try rewording the note",
    );
    return sanitizePostDrafts(input, output, model);
  }
}

/** The configured writer, or null when no API key is set (the audit then shows rule-based fixes only). */
export function getAiWriter(): AiWriter | null {
  const key = serverEnv().ANTHROPIC_API_KEY;
  return key ? new ClaudeWriter(key) : null;
}

/** Post drafts: Claude when a key is set, otherwise clearly labelled sample drafts. */
export function getPostWriter(): AiWriter {
  return getAiWriter() ?? new SampleWriter();
}
