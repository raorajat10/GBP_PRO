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

  // WhatsApp Cloud API (M7) — only needed when MESSAGING_PROVIDER=meta
  META_WA_ACCESS_TOKEN: z.string().min(1).optional(),
  META_WA_PHONE_NUMBER_ID: z.string().regex(/^\d+$/).optional(),
  META_APP_SECRET: z.string().min(1).optional(), // verifies webhook signatures
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(16).optional(),
  META_GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v23.0"),
  WA_TEMPLATE_APPROVAL: z.string().default("post_approval_request"),
  WA_TEMPLATE_REMINDER: z.string().default("approval_reminder"),

  // Google OAuth client (Google Cloud → Google Auth Platform → Clients). Secret: server only.
  GOOGLE_CLIENT_ID: z.string().endsWith(".apps.googleusercontent.com").optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(10).optional(),

  // Email through Resend (owner connect invites). EMAIL_FROM must be on the verified domain.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),

  // Grid ranking: "mock" = sample results (free); "google" = Places API (New) Text Search,
  // billed per grid point. GOOGLE_PLACES_API_KEY must be server-only and restricted to the
  // Places API (New) in Google Cloud.
  RANK_PROVIDER: z.enum(["mock", "google"]).default("mock"),
  GOOGLE_PLACES_API_KEY: z.string().min(20).optional(),
  // Google's FREE Text Search Pro requests per month for our billing account: 5000 by
  // default, 35000 for India-priced accounts. We stop at 90% of this so scans stay free.
  RANK_FREE_SEARCHES_PER_MONTH: z.coerce.number().int().min(0).max(1_000_000).default(5000),
  // Grid points each business may scan per month (a 5×5 scan uses 25). Per-client values in
  // clients.rank_points_per_month can only lower this.
  RANK_POINTS_PER_CLIENT_MONTH: z.coerce.number().int().min(0).max(10_000).default(100),

  // Scheduled jobs (Vercel Cron sends "Authorization: Bearer $CRON_SECRET")
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  // `KEY=` (blank, as in .env.example) means "not set", not "set to an empty string".
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ""),
  );
  const result = serverEnvSchema.safeParse(cleaned);
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
