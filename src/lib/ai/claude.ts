import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getAiTaskConfig } from "@/config/ai";
import { serverEnv } from "@/lib/env";
import { AUDIT_FIX_SYSTEM, auditFixUserMessage } from "./prompts/audit-fix";
import {
  AiError,
  sanitizeAuditFixes,
  type AiWriter,
  type AuditFixRequest,
  type AuditFixResult,
} from "./writer";

const AuditFixOutput = z.object({
  fixes: z.array(z.object({ key: z.string(), text: z.string() })),
  suggestedDescription: z.string().nullable(),
});

/** AiWriter backed by the Anthropic API. Model and effort come from src/config/ai.ts. */
export class ClaudeWriter implements AiWriter {
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
    this.model = getAiTaskConfig("audit").model;
  }

  async writeAuditFixes(input: AuditFixRequest): Promise<AuditFixResult> {
    const cfg = getAiTaskConfig("audit");
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        output_config: { effort: cfg.effort, format: betaZodOutputFormat(AuditFixOutput) },
        // If the model declines for policy reasons, the API retries on its default fallback.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: AUDIT_FIX_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: auditFixUserMessage(input) }],
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
      throw new AiError(
        "The AI declined to write these fixes. The standard fixes are shown.",
        "refused",
      );
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new AiError("The AI's answer was incomplete. Try again.", "invalid_output");
    }
    return sanitizeAuditFixes(input, response.parsed_output, response.model);
  }
}

/** The configured writer, or null when no API key is set (the app then shows rule-based fixes only). */
export function getAiWriter(): AiWriter | null {
  const key = serverEnv().ANTHROPIC_API_KEY;
  return key ? new ClaudeWriter(key) : null;
}
