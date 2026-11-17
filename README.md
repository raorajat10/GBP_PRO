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

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of the above on every PR.

## Configuration

- **Brand name:** [`src/config/brand.ts`](src/config/brand.ts)
- **Claude model per task:** [`src/config/ai.ts`](src/config/ai.ts). Defaults: posts, review replies and report summary use `claude-sonnet-5-5`; the audit uses `claude-opus-5-5`. Override per task with `AI_MODEL_POSTS`, `AI_MODEL_REVIEW_REPLIES`, `AI_MODEL_AUDIT` or `AI_MODEL_REPORT_SUMMARY`.
- **Providers:** `GBP_PROVIDER=mock|google` and `MESSAGING_PROVIDER=mock|meta`. Both default to `mock`.
- **Env validation:** [`src/lib/env.ts`](src/lib/env.ts). An invalid value fails at startup with a clear message.

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
2. On Vercel (**Pro plan**, which is required for commercial use), import the repo. The region is already pinned to `bom1` in `vercel.json`.
3. Add the env vars from `.env.example`. Every PR then gets a preview URL.
