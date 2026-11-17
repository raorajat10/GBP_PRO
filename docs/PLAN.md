# GBP Growth Platform — Phase 1 Plan

Status: **Approved 2026-11-17** (with the changes below) · Build started at M1.

This is an original product. Nothing here is copied from any competitor's code, UI, text or branding. All integrations use official, documented APIs only.

## Approved decisions (2026-11-17)

| #       | Decision                                                                                                                                                                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1      | Own brand name, not "Sarvatra". Placeholder **"GBP Pro"**, kept in one config value (`src/config/brand.ts`). The final name and domain will be confirmed later.                                                                               |
| Q5      | Apply for GBP API access using **Sarvatra Energy Pvt Ltd's** existing verified Google Business Profile and website.                                                                                                                           |
| Q6      | Support both connection methods. **Default and recommended: the client adds our team's Google account as Manager.** Owner OAuth is the alternative.                                                                                           |
| Q8      | **Meta WhatsApp Cloud API directly**, no BSP/reseller.                                                                                                                                                                                        |
| AI      | Model is a **setting per task** (`src/config/ai.ts`). Defaults: posts → Claude Sonnet 5.5, review replies → Claude Sonnet 5.5, profile audit → Claude Opus 5.5. Report summary → Sonnet 5.5 (follows the "everything except the audit" rule). |
| Hosting | **Vercel Hobby (free) during the non-commercial build/test phase.** Move to Vercel Pro (or a Mumbai VPS) **before the first paying client**, as part of M12. Hobby terms allow only non-commercial use.                                       |
| Others  | All other defaults in §1 accepted.                                                                                                                                                                                                            |

---

## 0. Guardrails built into the design (not just policy)

These rules are enforced in code and the database, so a bug or a hurried team member can't break them.

| Rule                                | How the system enforces it                                                                                                                                                                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official GBP APIs + OAuth only      | The only way to reach Google is the `GbpProvider` interface. Its real implementation calls only documented Google Business Profile APIs with the owner's OAuth token. No scraping libraries are installed.                                                                             |
| No review gating                    | The review link and QR go **straight** to Google's official "write a review" URL (`https://search.google.com/local/writereview?placeid=<PLACE_ID>`). Our short link `/r/<slug>` is an instant 302 redirect with no page, no rating question and no feedback form. A test asserts this. |
| No fake reviews                     | There is no feature for creating or soliciting reviews beyond the single public link. The AI only drafts **replies** to real reviews pulled from Google.                                                                                                                               |
| No posting without client approval  | `publishPost()` refuses to run unless an `approvals` row for that post has `status = 'approved'`. A database trigger blocks moving a post to `scheduled` or `published` without one. If the client doesn't reply, the post expires. It is never auto-posted.                           |
| Review replies approved by the team | Same pattern: a reply is posted only after a team member approves it (`approved_by` is required).                                                                                                                                                                                      |
| Mock until Google approves access   | `GBP_PROVIDER=mock                                                                                                                                                                                                                                                                     | google` environment switch. Both implementations pass the same contract test suite. |

---

## 1. Questions (answered — see "Approved decisions" above)

Kept for the record. Where an approved decision differs from a default below, the decision wins.

**Business and branding**

1. **Product name and domain?** These are needed early: Google's OAuth consent screen, the WhatsApp display name and Meta business verification all show them. _Default: placeholder "GrowLocal" until you choose._
2. **Single agency or multi-agency?** Is this only for your team, or will you resell it to other agencies later? _Default: single agency, with the schema kept simple and no tenant layer._
3. **Team size and roles?** _Default: `admin` (everything) and `manager` (assigned clients only). Clients get a `client` role._
4. **Brand look:** do you have colours or a logo? _Default: I propose an original palette and type in Milestone 1 for your sign-off._

**Google connection** 5. **Does your company own a verified Google Business Profile that is 60+ days old and lists your website?** Google expects this when you apply for API access (see §6). _If not, create and verify one now; this is the longest lead-time item._ 6. **How do clients connect?** The brief says the owner connects via OAuth (Option A). Option B is also fully official and has much less friction: the owner adds your team's Google account as a **Manager** on their profile once, and you connect that one account via OAuth. _Default: support both behind the same interface, and recommend B for owners who aren't comfortable with tech._ 7. **Multiple locations per client?** Some battery or solar dealers have 2–3 shops. _Default: the schema supports many locations, and the UI is tuned for one._

**WhatsApp** 8. **Connect directly to Meta's WhatsApp Cloud API, or use a provider (BSP) such as Interakt, AiSensy or Gupshup?** _Default: direct Meta Cloud API. There's no monthly platform fee, and the interface lets you swap later._ 9. **Is there a dedicated phone number for the business WhatsApp?** It must not be active on the normal WhatsApp app. _Default: you get a new number._ 10. **Who sends review requests to the client's customers?** _Default: the owner shares the link or QR from their own WhatsApp or counter standee. This is free, needs no customer opt-in from us, and avoids marketing-message costs. Sending from our number would need customer opt-in and a paid marketing template, so it's left out of Phase 1._

**Workflow** 11. **Approval timing:** what happens if the client doesn't respond? _Default: reminder after 24 h, expiry after 72 h, then the team is notified. Never auto-post._ 12. **Negative reviews (1–2★):** should the client also see the draft before it's posted? _Default: team approval only (as in the brief), and 1–2★ reviews are flagged "priority" for a manager._ 13. **Languages:** _Default: Hindi in Devanagari, Hinglish in Roman script, English. A review reply defaults to the review's own language._ 14. **Photo intake:** in Phase 1, does the team upload photos in the dashboard, or should owners send photos on WhatsApp and get a draft back automatically? _Default: dashboard upload in Phase 1, with WhatsApp photo intake as the first Phase 1.5 item._ 15. **Weekly report:** _Default: Monday 10:00 IST, PDF in English with a short WhatsApp summary in the client's preferred language._ 16. **Billing or subscriptions in Phase 1?** _Default: no. Invoicing stays manual for now._ 17. **Data location:** _Default: Supabase in Mumbai (`ap-south-1`), Vercel functions in Mumbai (`bom1`), in line with the DPDP Act 2023._

---

## 2. Architecture

### 2.1 Diagram

```
                ┌─────────────────────────── Users ───────────────────────────┐
                │  Team (agency view)        Client owner (simple view)        │
                │  browser                   browser / WhatsApp                │
                └────────┬───────────────────────────┬────────────────────────┘
                         │ HTTPS                     │ WhatsApp tap / magic link
                         ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Next.js App (App Router, TypeScript) on Vercel             │
│                                                                              │
│  UI: (agency)/*   (client)/*   /approve/[token]   /r/[slug] (302 → Google)    │
│                                                                              │
│  Server Actions / Route Handlers                                             │
│   ├─ /api/oauth/google/*        (connect GBP — mock now, real later)         │
│   ├─ /api/webhooks/whatsapp     (button taps, delivery status; signed)       │
│   └─ /api/inngest               (background job endpoint)                    │
│                                                                              │
│  Domain modules (src/lib) — pure TS, unit-tested                              │
│   audit · posts · reviews · approvals · reports · review-links               │
│                                                                              │
│  Adapters (interfaces → swappable implementations)                            │
│   GbpProvider ──┬─ MockGbpProvider   (seeded fake data)                       │
│                 └─ GoogleGbpProvider (official APIs, after approval)          │
│   MessagingProvider ─┬─ MockMessaging (logs to DB / console)                  │
│                      └─ MetaCloudWhatsApp (or a BSP later)                    │
│   AiWriter ──── ClaudeWriter (Anthropic SDK)  · FakeWriter (tests)            │
└───────┬───────────────────┬────────────────────┬───────────────────┬─────────┘
        │                   │                    │                   │
        ▼                   ▼                    ▼                   ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ Supabase      │  │ Inngest         │  │ Anthropic API   │  │ Google GBP APIs   │
│ Postgres+RLS  │  │ cron + queues + │  │ (Claude)        │  │ Meta WhatsApp     │
│ Auth, Storage │  │ retries         │  │                 │  │ Cloud API         │
└───────────────┘  └─────────────────┘  └─────────────────┘  └──────────────────┘
```

### 2.2 Background jobs (Inngest)

| Job                                   | Trigger                | Does                                                                                                 |
| ------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `post.publish`                        | at `scheduled_for`     | Checks the approval, publishes via `GbpProvider`, retries ×3, marks the post `published` or `failed` |
| `approval.remind` / `approval.expire` | +24 h / +72 h          | WhatsApp reminder, then expiry and a team alert                                                      |
| `reviews.sync`                        | every 6 h per location | Pulls new reviews and creates AI reply drafts                                                        |
| `reply.post`                          | on approve             | Posts the reply via `GbpProvider`                                                                    |
| `metrics.sync`                        | daily 06:00 IST        | Pulls daily performance metrics                                                                      |
| `audit.run`                           | on connect + weekly    | Recomputes the audit score                                                                           |
| `report.weekly`                       | Monday 10:00 IST       | Builds the PDF and sends the WhatsApp summary                                                        |

Inngest was chosen because it runs serverless on Vercel (no worker server), has a dashboard showing every run, and handles retries and cron out of the box. The fallback, if we ever want one fewer vendor, is Vercel Cron plus a Postgres job table.

### 2.3 Key flows

**Post creation → approval → publish**

1. A manager uploads a photo and types a note ("Exide inverter battery offer, 2-year warranty").
2. Claude returns 2–3 drafts in the chosen language (≤1,500 characters, the GBP limit). Rules: no phone numbers in the body (a call-to-action button is used instead), no invented prices or offers, no medical claims for clinics.
3. The manager edits, picks a draft and sets the schedule time, then clicks "Send for approval".
4. The client gets a WhatsApp template with the image and text plus the buttons **Approve ✅** and **Request change ✏️**. There's also a magic-link fallback page at `/approve/<token>`.
5. On Approve, the post becomes `scheduled` and `post.publish` runs at that time. On Request change, the client's note goes to the manager, who revises and resends.

**Review reply**

1. A new review is synced, its language is detected, and Claude drafts a reply in that language.
2. The team approves, edits or discards it in the review inbox, then `reply.post` publishes it.

**Weekly report**

1. Metrics for the last complete 7 days (Google's performance data lags a few days, so the report shows exact dates) plus the week's reviews, replies and posts.
2. The PDF is rendered with `@react-pdf/renderer` and stored in Supabase Storage.
3. A WhatsApp utility template is sent with a 4-line summary and the PDF as a document.

---

## 3. Database schema (PostgreSQL / Supabase)

Row-level security (RLS) is on for every table. Admins see everything, managers see their assigned clients, and client users see only their own client.

```sql
-- People
profiles (
  id uuid pk references auth.users,
  full_name text, phone text,
  role text check (role in ('admin','manager','client')),
  created_at timestamptz default now()
)

clients (
  id uuid pk, business_name text not null, owner_name text,
  owner_whatsapp text,                         -- E.164, e.g. +9198xxxxxxx
  whatsapp_opt_in_at timestamptz,              -- consent to receive our messages
  preferred_language text check (preferred_language in ('en','hi','hinglish')),
  industry text,                               -- battery, solar, clinic, retail...
  brand_notes text,                            -- tone, USPs, do/don't (fed to AI)
  assigned_manager_id uuid references profiles,
  status text default 'active',                -- active | paused | churned
  created_at timestamptz default now()
)

client_users (client_id uuid references clients, user_id uuid references profiles,
              primary key (client_id, user_id))

-- Google connection
gbp_connections (
  id uuid pk, client_id uuid references clients,
  provider text check (provider in ('mock','google')),
  mode text check (mode in ('owner_oauth','agency_manager')),   -- Q6
  google_account_name text,                    -- e.g. accounts/123
  refresh_token_encrypted bytea,               -- AES-GCM, key in env
  scopes text[], status text,                  -- connected | revoked | error
  connected_at timestamptz, last_sync_at timestamptz
)

locations (
  id uuid pk, client_id uuid references clients,
  connection_id uuid references gbp_connections,
  gbp_location_name text unique,               -- e.g. locations/987
  place_id text, title text, primary_category text,
  address jsonb, phone text, website text,
  review_url text,                             -- writereview?placeid=...
  snapshot jsonb,                              -- last full profile pull (for audit)
  synced_at timestamptz
)

-- Audit
audits (id uuid pk, location_id uuid references locations,
        score int check (score between 0 and 100),
        created_at timestamptz default now())
audit_items (
  id uuid pk, audit_id uuid references audits,
  check_key text,                              -- e.g. 'description_length'
  status text check (status in ('pass','warn','fail')),
  points_lost int, rank int,
  title text, fix_text text                    -- shown in ranked fix list
)

-- Content
media_assets (id uuid pk, client_id uuid references clients, storage_path text,
              mime text, width int, height int, bytes int,
              uploaded_by uuid references profiles, created_at timestamptz)

posts (
  id uuid pk, location_id uuid references locations,
  status text check (status in ('draft','pending_approval','changes_requested',
         'scheduled','publishing','published','expired','failed')),
  language text, topic_type text check (topic_type in ('STANDARD','OFFER','EVENT')),
  body text check (char_length(body) <= 1500),
  cta_type text, cta_url text,
  media_asset_id uuid references media_assets,
  source_note text,                            -- what the team typed
  ai_model text, scheduled_for timestamptz, published_at timestamptz,
  gbp_post_name text,                          -- id returned by Google
  error text, created_by uuid references profiles, created_at timestamptz
)

approvals (
  id uuid pk,
  subject_type text check (subject_type in ('post')),
  subject_id uuid,
  token_hash text unique,                      -- magic link token (hashed)
  channel text,                                -- whatsapp | web
  status text check (status in ('pending','approved','changes_requested','expired')),
  response_note text, responded_at timestamptz,
  wa_message_id text, expires_at timestamptz, created_at timestamptz
)
-- Trigger: posts.status may become 'scheduled'/'publishing'/'published' only if an
-- approvals row for that post has status='approved'.

-- Reviews
reviews (
  id uuid pk, location_id uuid references locations,
  gbp_review_name text unique, reviewer_name text,
  star_rating int check (star_rating between 1 and 5),
  comment text, language_detected text,
  create_time timestamptz, update_time timestamptz,
  existing_reply text, existing_reply_time timestamptz,   -- reply already on Google
  priority boolean default false, synced_at timestamptz
)

review_replies (
  id uuid pk, review_id uuid references reviews,
  draft_text text, final_text text, language text,
  status text check (status in ('draft','approved','posted','failed','discarded')),
  approved_by uuid references profiles,        -- required before 'posted'
  ai_model text, posted_at timestamptz, error text, created_at timestamptz
)

review_links (
  id uuid pk, location_id uuid references locations,
  slug text unique, target_url text,           -- always the Google writereview URL
  scan_count int default 0, created_at timestamptz
)

-- Performance + reports
metrics_daily (
  location_id uuid references locations, date date,
  impressions_search int, impressions_maps int,
  calls int, direction_requests int, website_clicks int,
  primary key (location_id, date)
)

reports (
  id uuid pk, client_id uuid references clients,
  period_start date, period_end date,
  data jsonb,                                  -- frozen numbers used in PDF
  pdf_path text, status text, wa_sent_at timestamptz, created_at timestamptz
)

-- Messaging + traceability
whatsapp_messages (
  id uuid pk, client_id uuid references clients,
  direction text check (direction in ('out','in')),
  template_name text, wa_message_id text, payload jsonb,
  status text,                                 -- sent | delivered | read | failed
  created_at timestamptz
)

activity_log (id bigserial pk, actor_id uuid, action text, entity text,
              entity_id uuid, data jsonb, created_at timestamptz default now())
```

### 3.1 Audit scoring (deterministic, no AI needed for the score)

There are 100 points across weighted checks. Each failed check produces a fix item ranked by points lost. Claude is used only to word the fix suggestions (for example, a better business description).

| Check                                                                 | Points |
| --------------------------------------------------------------------- | ------ |
| Business description present, 250–750 chars, mentions services + area | 10     |
| Primary category set + ≥2 relevant secondary categories               | 10     |
| Regular hours set; special/holiday hours set for upcoming festivals   | 8      |
| Phone + website present                                               | 6      |
| Photos: ≥10 total, ≥1 added in last 30 days, logo + cover set         | 14     |
| Posts: ≥1 in last 7 days (4 in last 30)                               | 12     |
| Reviews: count vs. target (≥25), avg rating ≥4.2                      | 14     |
| Review reply rate ≥90% in last 90 days, median reply time ≤48 h       | 12     |
| Services / products listed                                            | 8      |
| Attributes filled (e.g., wheelchair access, payments)                 | 6      |

The weights live in one config file so we can tune them later.

---

## 4. Folder structure

```
/
├─ docs/PLAN.md
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/
│  │  ├─ (agency)/                 # team view
│  │  │  ├─ dashboard/             # all clients: score, pending approvals, alerts
│  │  │  ├─ clients/[clientId]/
│  │  │  │  ├─ overview/  audit/  posts/  reviews/  review-link/  reports/  settings/
│  │  │  └─ inbox/                 # all reviews needing replies, all approvals
│  │  ├─ (client)/home/            # simple owner view: score, this week, approvals
│  │  ├─ approve/[token]/          # no-login approval page (WhatsApp fallback)
│  │  ├─ r/[slug]/route.ts         # 302 → Google review page (no gating)
│  │  └─ api/
│  │     ├─ oauth/google/{start,callback}/route.ts
│  │     ├─ webhooks/whatsapp/route.ts
│  │     └─ inngest/route.ts
│  ├─ lib/
│  │  ├─ gbp/
│  │  │  ├─ types.ts               # Location, Review, Post, Metrics DTOs
│  │  │  ├─ provider.ts            # GbpProvider interface + factory (env switch)
│  │  │  ├─ mock/                  # MockGbpProvider + seed fixtures
│  │  │  └─ google/                # GoogleGbpProvider (after approval)
│  │  ├─ messaging/
│  │  │  ├─ provider.ts            # MessagingProvider interface
│  │  │  ├─ mock.ts
│  │  │  └─ meta-cloud.ts          # WhatsApp Cloud API + signature verification
│  │  ├─ ai/
│  │  │  ├─ writer.ts              # AiWriter interface
│  │  │  ├─ claude.ts              # Anthropic SDK implementation
│  │  │  └─ prompts/               # post, review-reply, audit-fix, report-summary
│  │  ├─ audit/                    # checks + weights + scorer (pure functions)
│  │  ├─ posts/  reviews/  approvals/  reports/  review-links/
│  │  ├─ db/                       # Supabase clients (server/browser), typed queries
│  │  └─ crypto.ts                 # token encryption, approval token hashing
│  ├─ jobs/                        # Inngest functions (one file per job)
│  ├─ components/                  # UI kit (our own design tokens)
│  └─ styles/
├─ supabase/
│  ├─ migrations/                  # SQL, versioned
│  └─ seed.sql                     # demo agency, 5 demo clients, mock data
├─ tests/
│  ├─ unit/                        # audit, prompts, approval rules
│  ├─ contract/                    # same suite runs vs Mock and Google providers
│  └─ e2e/                         # Playwright on mock providers
├─ .env.example
└─ package.json
```

---

## 5. Build plan: milestones

Each milestone ends with something you can click or a test you can run. Times assume one full-time developer.

| #       | Milestone                                                                                                                                                                                   | Done when (your acceptance test)                                                                                           | Est.  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| **M1**  | Project setup: Next.js, Tailwind, Supabase (Mumbai), lint, Vitest, Playwright, GitHub CI, Vercel preview deploys; original brand palette proposed                                           | A preview URL loads; CI is green on a PR                                                                                   | 2 d   |
| **M2**  | Auth and roles: invite-only team login (email code), roles, RLS policies + tests against the real DB. _(Google sign-in moved to M4; client-user invites moved to M3 with client creation.)_ | A manager sees only assigned clients; a client user sees only their own business (automated RLS tests)                     | 3 d   |
| **M3**  | Clients and agency dashboard shell: add/edit clients, assign managers, client list with status chips                                                                                        | You can add 5 clients and see them listed                                                                                  | 2 d   |
| **M4**  | Mock GBP layer: `GbpProvider` interface, `MockGbpProvider` with seeded profiles/reviews/metrics, mock "Connect Google" flow, location sync, Google sign-in for the team                     | Clicking "Connect" on a client shows its mock profile; contract tests pass                                                 | 3 d   |
| **M5**  | Profile audit: scorer + ranked fix list UI, AI-worded fixes                                                                                                                                 | Seeded "weak" profile scores lower than "strong" one; every check unit-tested                                              | 3 d   |
| **M6**  | AI post generator: photo upload (resize/validate), Claude drafts in EN/HI/Hinglish, editor, schedule picker                                                                                 | Uploading a photo plus a note gives 3 drafts in the chosen language, under 1,500 chars, with no phone numbers              | 4 d   |
| **M7**  | Approvals: magic-link page first, then `MessagingProvider` with mock and Meta Cloud (templates + webhook + signature check)                                                                 | Approve on WhatsApp (or link) and the post becomes `scheduled`; Request change returns it with the note; expiry after 72 h | 4 d   |
| **M8**  | Scheduler and publishing: Inngest jobs, publish via mock provider, retries, failure alerts                                                                                                  | A post scheduled 2 minutes ahead publishes; a post without approval cannot publish (test)                                  | 3 d   |
| **M9**  | Reviews: sync, inbox, AI reply drafts (EN/HI, same language as the review), team approve/edit, post reply                                                                                   | A new mock review appears with a draft; after approval it shows as replied                                                 | 3 d   |
| **M10** | Review link and QR: short link, QR (SVG/PNG), printable A5 counter standee PDF, WhatsApp share text                                                                                         | Scanning the QR opens Google's review box directly; the test confirms the 302 with no page in between                      | 2 d   |
| **M11** | Metrics and weekly report: daily metrics sync, report data snapshot, PDF, WhatsApp summary                                                                                                  | Clicking "Send test report" puts the PDF and summary on your phone                                                         | 4 d   |
| **M12** | Hardening and launch prep: activity log, Sentry, rate limits, backups, privacy policy and terms pages, OAuth demo video for Google verification                                             | Checklist signed off; pilot with 3 friendly clients on mock data plus real WhatsApp                                        | 3 d   |
| **M13** | Switch to the real Google API (after approval): `GoogleGbpProvider`, contract tests against a real test profile, gradual rollout per client                                                 | One real profile shows real data, and a test post and reply go live after approval                                         | 4–5 d |

**Total: about 6–8 weeks for one developer** to reach M12, and M13 once Google approves. M13 is independent of the rest, so the Google wait doesn't block anything.

**Out of scope for Phase 1** (parked): WhatsApp photo intake, sending review requests from our number, billing, Q&A, competitor tracking, multi-agency, a mobile app.

---

## 6. External accounts and approvals

Start these **now**; several take weeks.

### 6.1 Google Business Profile API access (longest lead time)

1. Use a company Google account, ideally Google Workspace on your own domain.
2. Make sure **your own business** has a verified Google Business Profile that is 60+ days old and lists your website. Google checks this.
3. Create a **Google Cloud project** (console.cloud.google.com) and note the **project number**.
4. Go to the official prerequisites page, _developers.google.com/my-business/content/prereqs_, and submit the **GBP API access request form**. Choose "Application for Basic API Access". Describe the use honestly: an agency managing clients' profiles with their consent, with posts and replies approved by the business. Approval usually takes **1–4 weeks**; a rejection can be appealed or the form resubmitted.
5. Once approved, enable these APIs: My Business Account Management, Business Information, Business Profile Performance, Verifications, Notifications, and the My Business API (v4, for reviews, posts and media).
6. **OAuth consent screen:** the scope `https://www.googleapis.com/auth/business.manage` is _sensitive_, so the app needs **Google verification** before the public can use it. Prepare:
   - your domain verified in Google Search Console
   - a homepage, privacy policy and terms on that domain
   - a short YouTube demo video of the connect flow and how the data is used

   Until verification is done, up to 100 test users can connect, which is enough for pilots.

### 6.2 WhatsApp Business Platform (Meta)

1. Create a **Meta Business Portfolio** at business.facebook.com and complete **business verification** (GST certificate or incorporation document, business website and domain).
2. Create a **WhatsApp Business Account** in Meta's developer dashboard (Cloud API), or with a BSP if you choose one.
3. Add a **dedicated phone number** and get the **display name** approved. It must match your brand.
4. Create a **system user** and a permanent access token, and set up the **webhook** (we provide the URL in M7).
5. Submit **message templates** (as _utility_, kept factual so they stay utility rather than marketing):
   - `post_approval_request`: image header, text, and buttons Approve / Request change
   - `approval_reminder`
   - `weekly_report`: document header for the PDF and a summary body
6. Collect each client's **opt-in** to receive WhatsApp messages from you (a checkbox in the onboarding form; we store `whatsapp_opt_in_at`).
7. Note: new numbers start at a low daily limit on business-initiated messages. It rises with verification and good quality ratings, and is plenty for 200 clients.

### 6.3 Other accounts

| Account                                   | Purpose                 | Notes                                                               |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Anthropic Console (console.anthropic.com) | Claude API              | Add billing and set a monthly spend limit                           |
| Supabase                                  | Database, auth, storage | Pro plan, Mumbai region                                             |
| Vercel                                    | Hosting                 | **Pro plan required** (Hobby is non-commercial only); region `bom1` |
| Inngest                                   | Background jobs         | Free tier to start                                                  |
| Domain + Google Workspace                 | Brand, OAuth, email     | The same domain is used for the Google and Meta verifications       |
| Sentry                                    | Error alerts            | Free tier                                                           |
| Resend (or Supabase SMTP)                 | Login emails            | Free tier                                                           |
| GitHub                                    | Code, CI                | Free / Team                                                         |

### 6.4 Legal and paperwork

- **Privacy policy and terms** on your site. Google and Meta both require them. Cover the **DPDP Act 2023** (consent, purpose, deletion on request).
- A **client service agreement** that authorises you to manage their GBP, states that every post needs their approval, and records WhatsApp consent.
- An internal policy that is also shown in the app: no review gating, no incentivised or fake reviews (these match Google's own policies).

---

## 7. Monthly running cost estimate (software)

Updated for the approved model split and direct Meta API. Assumptions: ₹88 = $1. Per client per month: about 12 posts (with about 2 AI generations each), about 20 review replies, 4 audits, 4 reports and about 25 WhatsApp utility messages. Prices are list prices as of Nov 2026 and should be rechecked before launch.

**AI cost per client per month**

| Task                  | Model                       | Volume | Tokens per call (in / out) | Cost                   |
| --------------------- | --------------------------- | ------ | -------------------------- | ---------------------- |
| Post drafts           | Sonnet 5.5 ($2 / $10 per M) | 24     | 3k / 1.5k                  | ≈ $0.50                |
| Review replies        | Sonnet 5.5                  | 20     | 1.5k / 0.6k                | ≈ $0.18                |
| Profile audit wording | Opus 5.5 ($4 / $20 per M)   | 4      | 4k / 1.5k                  | ≈ $0.18                |
| Report summary        | Sonnet 5.5                  | 4      | 3k / 0.5k                  | ≈ $0.04                |
| **Total**             |                             |        |                            | **≈ $0.90 per client** |

| Item                                                                                         | 50 clients                 | 200 clients                             |
| -------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------- |
| Vercel Pro                                                                                   | $20 (1 seat)               | $40 (2 seats)                           |
| Supabase Pro (Mumbai)                                                                        | $25                        | ~$40 (larger compute)                   |
| Inngest                                                                                      | $0 (free tier)             | $0–75 (depends on run volume)           |
| Claude API (split above)                                                                     | ~$45                       | ~$180                                   |
| WhatsApp, Meta per-message fees (utility ≈ ₹0.12/msg in India; replies within 24 h are free) | ~₹150 (~$2)                | ~₹600 (~$7)                             |
| WhatsApp BSP fee                                                                             | ₹0 (direct Cloud API)      | ₹0                                      |
| Email, Sentry, domain (amortised)                                                            | ~$5                        | ~$25                                    |
| **Total software**                                                                           | **≈ $97 ≈ ₹8,500 / month** | **≈ $290–365 ≈ ₹25,500–32,000 / month** |
| **Software per client**                                                                      | ≈ ₹170                     | ≈ ₹130–160                              |

Not included here: staff (see §9), Google Workspace seats (~₹160–₹1,000 per user per month), and one-time costs (the domain and any legal drafting).

---

## 8. Engineering notes

- **Testing:** pure domain logic is unit-tested, the provider interfaces have contract tests, and the key journeys run end to end on mock providers in CI (connect → audit → post → approve → publish; review → reply; QR redirect; weekly report).
- **Security:** Google refresh tokens are encrypted at rest, approval tokens are single-use and hashed, WhatsApp webhooks are signature-verified, RLS is on every table, and every approval or publish is recorded in `activity_log`.
- **AI guardrails:** the prompts forbid invented prices, offers, guarantees, medical claims or phone numbers in the body. Output is checked against the GBP limits before saving, and a human always reviews it.
- **Simplicity:** one Next.js app, one database and one job runner. No microservices.

---

## 9. Staffing and full cost per client

### 9.1 Account manager workload (per client, per week, once the tool is in place)

| Task                                                                      | Time                           |
| ------------------------------------------------------------------------- | ------------------------------ |
| 3 posts: collect photo/note, pick and edit an AI draft, send for approval | 30 min                         |
| ~5 review replies: check and approve AI drafts                            | 10 min                         |
| Chase approvals, answer the owner's WhatsApp queries                      | 15 min                         |
| Audit fixes (hours, photos, services), averaged weekly                    | 15 min                         |
| Check the weekly report before it goes out                                | 5 min                          |
| Buffer (escalations, one-off requests)                                    | 15 min                         |
| **Total**                                                                 | **≈ 1.5 h/week ≈ 6.5 h/month** |

One account manager has about 140 productive hours a month, so the realistic load is about **25 clients per account manager** (range 20–35). Expect closer to 20 while the team and product are new, and about 30–35 once templates and habits settle.

### 9.2 Staff cost (Jaipur, loaded monthly cost)

| Role                                                      | Salary                                             | Loaded cost (PF/ESI, laptop, phone, internet, workspace) |
| --------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Account manager (digital marketing exec, Hindi + English) | ₹22,000–28,000                                     | **≈ ₹30,000**                                            |
| Team lead / senior AM (from about 6 AMs)                  | ₹35,000–40,000                                     | **≈ ₹45,000**                                            |
| Developer for maintenance                                 | part-time contract at 50 clients; full-time at 200 | ≈ ₹30,000 (part-time) / ≈ ₹70,000 (full-time)            |

Founder or director time (sales, oversight) is not costed.

### 9.3 Full monthly cost per client (software + staff)

|                                         | 50 clients             | 200 clients             |
| --------------------------------------- | ---------------------- | ----------------------- |
| Account managers                        | 2 × ₹30,000 = ₹60,000  | 8 × ₹30,000 = ₹2,40,000 |
| Team lead                               | — (founder supervises) | ₹45,000                 |
| Developer                               | ₹30,000 (part-time)    | ₹70,000 (full-time)     |
| **Staff subtotal**                      | **₹90,000**            | **₹3,55,000**           |
| Software (§7)                           | ₹8,500                 | ≈ ₹29,000               |
| **Total monthly cost**                  | **≈ ₹98,500**          | **≈ ₹3,84,000**         |
| **Full cost per client**                | **≈ ₹1,970**           | **≈ ₹1,920**            |
| Per client if AMs reach 33 clients each | ≈ ₹1,600               | ≈ ₹1,550                |

**What this means:** staff is about 90% of cost and software about 10%. The cost per client barely falls with scale, because account managers grow linearly with clients. Margin therefore comes from **price** and **clients per account manager**, not from software savings. At a price of ₹3,999/month, gross margin is about 50%; at ₹4,999, about 60%. The most valuable product work is anything that cuts account-manager minutes per client: one-tap approvals, good first AI drafts, and WhatsApp photo intake (Phase 1.5).

---

**Next step:** M1 is in progress. In parallel, start §6.1 (Google API access, using Sarvatra Energy Pvt Ltd's profile and website) and §6.2 (Meta business verification) today, since those are the long waits.
