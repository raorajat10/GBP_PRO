-- M4: Google Business Profile connections and linked locations (docs/PLAN.md §3).
--
-- gbp_connections holds Google credentials, so NO signed-in user can read it through the
-- Data API — only server code using the secret key, after checking permissions.
--   mode 'agency_manager': our team's Google account (clients add us as Manager); client_id null
--   mode 'owner_oauth'   : an owner's own Google account, tied to one client

create table public.gbp_connections (
  id                        uuid primary key default gen_random_uuid(),
  provider                  text not null check (provider in ('mock', 'google')),
  mode                      text not null check (mode in ('agency_manager', 'owner_oauth')),
  client_id                 uuid references public.clients (id) on delete cascade,
  google_account_name       text not null,          -- e.g. accounts/123
  google_account_label      text,                   -- shown in the UI (name or email)
  refresh_token_encrypted   text,                   -- null for sample (mock) connections
  status                    text not null default 'connected'
                              check (status in ('connected', 'revoked', 'error')),
  last_error                text,
  connected_by              uuid references public.profiles (id) on delete set null,
  connected_at              timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check ((mode = 'owner_oauth') = (client_id is not null)),
  unique nulls not distinct (provider, google_account_name, client_id)
);

create trigger gbp_connections_updated_at before update on public.gbp_connections
  for each row execute function app.set_updated_at();

create table public.locations (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients (id) on delete cascade,
  connection_id       uuid not null references public.gbp_connections (id) on delete restrict,
  gbp_account_name    text not null,
  gbp_location_name   text not null unique,   -- one Google profile → one client
  title               text not null,
  place_id            text,
  primary_category    text,
  address             jsonb,
  phone               text,
  website             text,
  -- Official Google "write a review" link. Same link for every customer (no review gating).
  review_url          text generated always as (
                        case when place_id is not null
                             then 'https://search.google.com/local/writereview?placeid=' || place_id
                        end) stored,
  snapshot            jsonb not null,          -- profile + photo/post/review/metric summary (for the audit)
  synced_at           timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index locations_client_idx on public.locations (client_id);
create index locations_connection_idx on public.locations (connection_id);

-- ─────────────────────────────── Row-level security ───────────────────────────────

alter table public.gbp_connections enable row level security;
alter table public.locations       enable row level security;

-- Credentials: no policies at all → only the server (secret key) can touch this table.
revoke all on public.gbp_connections from anon, authenticated;

-- Locations: readable by anyone who can see the client; written only by the server
-- (linking and syncing go through authorised server code).
revoke all on public.locations from anon;
revoke insert, update, delete on public.locations from authenticated;

create policy "locations: read if client is accessible" on public.locations
  for select to authenticated using (app.can_access_client(client_id));
