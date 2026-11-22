-- Grid ranking and competitors (owner portal → Insights).
-- A scan searches one keyword from every point of a grid around the business and records
-- where the business ranks there, plus who else shows up. Reads go through row-level
-- security; every write goes through server code with the secret key after access checks.

-- Grid points a client may scan per calendar month (cost control for paid searches).
alter table public.clients
  add column rank_points_per_month int not null default 250
    check (rank_points_per_month between 0 and 10000);

create table public.rank_keywords (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  location_id  uuid not null references public.locations (id) on delete cascade,
  keyword      text not null check (char_length(keyword) between 2 and 80),
  grid_size    int not null default 5 check (grid_size in (3, 5, 7)),
  radius_km    numeric(5, 2) not null default 5 check (radius_km between 0.5 and 50),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index rank_keywords_unique on public.rank_keywords (location_id, lower(keyword));
create index rank_keywords_client_idx on public.rank_keywords (client_id);

create table public.rank_scans (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  location_id   uuid not null references public.locations (id) on delete cascade,
  keyword_id    uuid not null references public.rank_keywords (id) on delete cascade,
  keyword       text not null,                        -- as scanned, kept if renamed later
  provider      text not null check (provider in ('mock', 'google')),
  status        text not null default 'running' check (status in ('running', 'done', 'failed')),
  grid_size     int not null check (grid_size in (3, 5, 7)),
  radius_km     numeric(5, 2) not null,
  center_lat    double precision not null,
  center_lng    double precision not null,
  points        int not null,                         -- grid_size², counts against the monthly limit
  found_points  int,
  top3_points   int,
  avg_rank      numeric(5, 2),                        -- average where found
  arp           numeric(5, 2),                        -- average with "not found" counted as 21
  best_rank     int,
  worst_rank    int,
  error         text,
  requested_by  uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index rank_scans_keyword_idx on public.rank_scans (keyword_id, created_at desc);
create index rank_scans_client_month_idx on public.rank_scans (client_id, created_at desc);

create table public.rank_scan_points (
  scan_id   uuid not null references public.rank_scans (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,  -- for row-level security
  row_idx   int not null,
  col_idx   int not null,
  lat       double precision not null,
  lng       double precision not null,
  rank      int check (rank is null or rank between 1 and 20),   -- null = not in the top 20
  results   jsonb not null default '[]'::jsonb,   -- [{placeId, name, address}] in rank order
  primary key (scan_id, row_idx, col_idx)
);

alter table public.rank_keywords    enable row level security;
alter table public.rank_scans       enable row level security;
alter table public.rank_scan_points enable row level security;

revoke all on public.rank_keywords, public.rank_scans, public.rank_scan_points from anon;
revoke insert, update, delete on public.rank_keywords, public.rank_scans, public.rank_scan_points
  from authenticated;

create policy "rank_keywords: read if client is accessible" on public.rank_keywords
  for select to authenticated using (app.can_access_client(client_id));
create policy "rank_scans: read if client is accessible" on public.rank_scans
  for select to authenticated using (app.can_access_client(client_id));
create policy "rank_scan_points: read if client is accessible" on public.rank_scan_points
  for select to authenticated using (app.can_access_client(client_id));
