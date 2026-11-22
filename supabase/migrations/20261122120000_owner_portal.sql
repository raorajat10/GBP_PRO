-- Owner portal (/home/…): data the business owner's pages read.
-- Pattern as elsewhere: owners and the team READ through row-level security
-- (app.can_access_client); every WRITE goes through server code with the secret key,
-- after that code has checked the caller's access.

-- ─────────────────────────────── Reviews (synced from Google) ───────────────────────────────

create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  location_id        uuid not null references public.locations (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete cascade,
  gbp_review_name    text not null unique,
  reviewer           text not null,
  star_rating        smallint not null check (star_rating between 1 and 5),
  comment            text,
  reviewed_at        timestamptz not null,
  reply_comment      text,
  replied_at         timestamptz,
  synced_at          timestamptz not null default now()
);
create index reviews_client_idx on public.reviews (client_id, reviewed_at desc);
create index reviews_location_idx on public.reviews (location_id, reviewed_at desc);

-- ─────────────────────────────── Daily Google metrics ───────────────────────────────

create table public.location_metrics_daily (
  location_id         uuid not null references public.locations (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete cascade,
  day                 date not null,
  impressions_search  int not null default 0 check (impressions_search >= 0),
  impressions_maps    int not null default 0 check (impressions_maps >= 0),
  calls               int not null default 0 check (calls >= 0),
  direction_requests  int not null default 0 check (direction_requests >= 0),
  website_clicks      int not null default 0 check (website_clicks >= 0),
  primary key (location_id, day)
);
create index location_metrics_daily_client_idx on public.location_metrics_daily (client_id, day);

-- ─────────────────────────────── Change requests (owner → team) ───────────────────────────────
-- Until Google API access is approved, owners ask for listing edits; the team applies them.

create table public.change_requests (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  area         text not null check (area in
                 ('info', 'hours', 'categories', 'attributes', 'services', 'photos', 'other')),
  message      text not null check (char_length(message) between 3 and 2000),
  status       text not null default 'open' check (status in ('open', 'done', 'declined')),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index change_requests_client_idx on public.change_requests (client_id, created_at desc);

-- ─────────────────────────────── Post bank (owner photos for future posts) ───────────────────────────────

create table public.post_bank_items (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  media_asset_id  uuid not null references public.media_assets (id) on delete cascade,
  caption         text not null default '' check (char_length(caption) <= 1000),
  wanted_on       date,
  status          text not null default 'submitted' check (status in ('submitted', 'used', 'declined')),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index post_bank_items_client_idx on public.post_bank_items (client_id, created_at desc);

-- ─────────────────────────────── Notifications (per business) ───────────────────────────────

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null check (kind in
                ('review', 'approval', 'score', 'ticket', 'report', 'feedback', 'general')),
  title       text not null check (char_length(title) between 1 and 200),
  body        text not null default '' check (char_length(body) <= 1000),
  link        text check (link is null or link ~ '^/'),   -- in-app paths only
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_client_idx on public.notifications (client_id, created_at desc);

-- ─────────────────────────────── Support tickets ───────────────────────────────

create table public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  created_by   uuid references public.profiles (id) on delete set null,
  subject      text not null check (char_length(subject) between 3 and 150),
  category     text not null check (category in
                 ('google_profile', 'reviews', 'posts', 'billing', 'other')),
  priority     text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  description  text not null check (char_length(description) between 10 and 4000),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  team_reply   text check (team_reply is null or char_length(team_reply) <= 4000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index support_tickets_client_idx on public.support_tickets (client_id, created_at desc);
create trigger support_tickets_updated_at before update on public.support_tickets
  for each row execute function app.set_updated_at();

-- ─────────────────────────────── Digital card taps ───────────────────────────────

create table public.card_events (
  id          bigint generated always as identity primary key,
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null check (kind in
                ('view', 'call', 'whatsapp', 'directions', 'website', 'review')),
  created_at  timestamptz not null default now()
);
create index card_events_client_idx on public.card_events (client_id, created_at desc);

-- ─────────────────────────────── Feedback status, owner preferences ───────────────────────────────

alter table public.review_feedback
  add column status text not null default 'pending'
    check (status in ('pending', 'contacted', 'resolved'));

alter table public.profiles
  add column notify_whatsapp boolean not null default true,
  add column notify_email    boolean not null default true;

-- ─────────────────────────────── Row-level security ───────────────────────────────

alter table public.reviews                 enable row level security;
alter table public.location_metrics_daily  enable row level security;
alter table public.change_requests         enable row level security;
alter table public.post_bank_items         enable row level security;
alter table public.notifications           enable row level security;
alter table public.support_tickets         enable row level security;
alter table public.card_events             enable row level security;

revoke all on public.reviews, public.location_metrics_daily, public.change_requests,
  public.post_bank_items, public.notifications, public.support_tickets, public.card_events
  from anon;
revoke insert, update, delete on public.reviews, public.location_metrics_daily,
  public.change_requests, public.post_bank_items, public.notifications,
  public.support_tickets, public.card_events
  from authenticated;

create policy "reviews: read if client is accessible" on public.reviews
  for select to authenticated using (app.can_access_client(client_id));
create policy "metrics: read if client is accessible" on public.location_metrics_daily
  for select to authenticated using (app.can_access_client(client_id));
create policy "change_requests: read if client is accessible" on public.change_requests
  for select to authenticated using (app.can_access_client(client_id));
create policy "post_bank: read if client is accessible" on public.post_bank_items
  for select to authenticated using (app.can_access_client(client_id));
create policy "notifications: read if client is accessible" on public.notifications
  for select to authenticated using (app.can_access_client(client_id));
create policy "tickets: read if client is accessible" on public.support_tickets
  for select to authenticated using (app.can_access_client(client_id));
create policy "card_events: read if client is accessible" on public.card_events
  for select to authenticated using (app.can_access_client(client_id));

-- Owners may now read the private feedback left on their own review page.
drop policy "review_feedback: team reads their clients' feedback" on public.review_feedback;
create policy "review_feedback: read if client is accessible" on public.review_feedback
  for select to authenticated using (app.can_access_client(client_id));
