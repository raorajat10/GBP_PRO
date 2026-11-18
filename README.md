# GBP Pro

Managed Google Business Profile growth platform for local businesses. "GBP Pro" is a placeholder name, set in [`src/config/brand.ts`](src/config/brand.ts).

The full plan, rules and milestones are in [`docs/PLAN.md`](docs/PLAN.md). Read §0 (guardrails) before changing anything about posting, reviews or Google access.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage; Mumbai) · Inngest (jobs, from M8) · Claude API · Meta WhatsApp Cloud API · Vercel (`bom1`).

> Next.js 16 differs from older versions. Before using a Next API you haven't used here, read the bundled docs in `node_modules/next/dist/docs/` (see `AGENTS.md`). Example: with Cache Components on, don't add `export const runtime`.

## Getting started

Requires Node 24+.

```bash
npm install
cp .env.example .env.local     # defaults run everything on mock providers
npm run dev                    # http://localhost:3000
```

## Scripts

| Command                           | What it does                                                            |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                     | Dev server                                                              |
| `npm run build` / `npm start`     | Production build / serve                                                |
| `npm run lint`                    | ESLint                                                                  |
| `npm run typecheck`               | Generate Next route types, then `tsc`                                   |
| `npm run format` / `format:check` | Prettier (with Tailwind class sorting)                                  |
| `npm test`                        | Unit + contract tests (Vitest)                                          |
| `npm run test:e2e`                | Browser tests (Playwright; first run `npx playwright install chromium`) |
| `npm run test:db`                 | Access-rule tests against the real Supabase project (local only)        |
| `npm run test:e2e:db`             | Full journeys against the real Supabase project (local only)            |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of the above on every PR.

## Configuration

- **Brand name:** [`src/config/brand.ts`](src/config/brand.ts)
- **Claude model per task:** [`src/config/ai.ts`](src/config/ai.ts). Defaults: posts, review replies and report summary use `claude-sonnet-5-5`; the audit uses `claude-opus-5-5`. Override per task with `AI_MODEL_POSTS`, `AI_MODEL_REVIEW_REPLIES`, `AI_MODEL_AUDIT` or `AI_MODEL_REPORT_SUMMARY`.
- **Providers:** `GBP_PROVIDER=mock|google` and `MESSAGING_PROVIDER=mock|meta`. Both default to `mock`.
- **Env validation:** [`src/lib/env.ts`](src/lib/env.ts). An invalid value fails at startup with a clear message.

## Google Business Profile (sample data until approved)

All Google access goes through `GbpProvider` ([src/lib/gbp/types.ts](src/lib/gbp/types.ts)). With `GBP_PROVIDER=mock` the app uses six sample Jaipur businesses, from weak to strong profiles. The real provider is added in M13 and must pass the same contract tests ([tests/contract/](tests/contract/)).

- **Recommended:** an admin connects the team Google account once (**Settings**). Clients add that account as a Manager on their Business Profile, and each profile is then linked to a client from the client's page.
- **Alternative:** the owner connects their own Google account from the client's page.
- Google credentials (`gbp_connections`) can't be read by any signed-in user, not even admins. Only server code can, after checking permissions.

## Profile audit

Each linked profile gets a 0–100 score from ten checks (description, categories, hours, photos, posts, reviews, replies and more), with a fix list ranked by points to win back. The score is plain code, no AI: [`src/lib/audit/checks.ts`](src/lib/audit/checks.ts). Weights, targets and the holiday list live in [`src/config/audit.ts`](src/config/audit.ts). Add next year's festival dates there each December.

- A new audit is saved on every link and **Sync now**, so the history shows progress. **Re-score** recomputes from the stored data without calling Google.
- **Write fixes with AI** asks Claude (the `audit` model in `src/config/ai.ts`) to make the fixes specific to the business and draft a description. It needs `ANTHROPIC_API_KEY`. Without the key, the standard fixes still show. AI text containing phone numbers or links, or a description outside 250–750 characters, is thrown away and the standard fix stays.
- AI wording carries over to the next audit for checks whose findings haven't changed, so a sync doesn't pay for it again.
- The weekly automatic re-audit arrives with the job runner in M8.

## Google sign-in for the team (optional)

1. In Google Cloud Console → **APIs & Services → OAuth consent screen**, set up an External app named after the product. Only the basic scopes are needed (email, profile, openid), so no Google review is required.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**, and add this authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase → **Authentication → Sign In / Providers → Google**, enable it and paste the client ID and secret.
4. Set `NEXT_PUBLIC_GOOGLE_SIGNIN=on` in Vercel and in `.env.local`, then redeploy.

Sign-in stays invite-only: with "Allow new users to sign up" off in Supabase, only emails already added by an admin can get in.

## Design tokens

These are defined once in [`src/app/globals.css`](src/app/globals.css) and used as Tailwind classes (`bg-primary`, `text-ink-muted`, `border-line`, …). Light and dark modes are both supported.

| Token               | Light                 | Use                       |
| ------------------- | --------------------- | ------------------------- |
| `primary`           | `#0F6E5C` teal        | Main actions, progress    |
| `accent`            | `#F2A33A` marigold    | Pending / needs attention |
| `paper` / `surface` | `#FAF8F4` / `#FFFFFF` | Page / cards              |
| `ink` / `ink-muted` | `#1B2430` / `#5A6573` | Text                      |

Typeface: **Mukta**, which covers both Latin and Devanagari, so English and Hindi share one font.

## Folder layout

See `docs/PLAN.md` §4. Supabase migrations live in `supabase/migrations/` (from M2).

## Deploying (one-time setup)

1. Push the repo to GitHub.
2. On Vercel, import the repo. Use the **Hobby (free) plan while the product is non-commercial** (build and testing). Upgrade to Pro before onboarding paying clients. The region is already pinned to `bom1` in `vercel.json`.
3. Add the env vars from `.env.example`. Every PR then gets a preview URL.
