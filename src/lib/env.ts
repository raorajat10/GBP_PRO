import { z } from "zod";

/**
 * Server-side environment, validated once.
 * In M1 only the provider switches are required (they have safe defaults);
 * Supabase, Anthropic and Meta keys become required in the milestones that use them.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),

  // Adapter switches — mock until real access is approved (see docs/PLAN.md §0)
  GBP_PROVIDER: z.enum(["mock", "google"]).default("mock"),
  MESSAGING_PROVIDER: z.enum(["mock", "meta"]).default("mock"),

  // Supabase (M2)
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),

  // Anthropic (M5/M6)
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
