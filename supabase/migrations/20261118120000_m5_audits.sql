-- M5: profile audits (docs/PLAN.md §3 and §3.1).
--
-- An audit is a scored copy of one location snapshot. A new audit is saved each time the
-- profile is linked or synced, so the history shows progress over time. The score itself
-- is deterministic (src/lib/audit); AI only rewords fix text afterwards.
-- Everything here is written only by server code (secret key) after a permission check.

create table public.audits (
  id                    uuid primary key default gen_random_uuid(),
  location_id           uuid not null references public.locations (id) on delete cascade,
  client_id             uuid not null references public.clients (id) on delete cascade, -- for row-level security
  score                 int not null check (score between 0 and 100),
  snapshot_synced_at    timestamptz not null,
  suggested_description text,               -- AI-written, ready to paste (null until worded)
  ai_model              text,               -- which model wrote the fix text, if any
  ai_worded_at          timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now()
);
create index audits_location_created_idx on public.audits (location_id, created_at desc);
create index audits_client_idx on public.audits (client_id);

create table public.audit_items (
  id           uuid primary key default gen_random_uuid(),
  audit_id     uuid not null references public.audits (id) on delete cascade,
  check_key    text not null,               -- e.g. 'description'
  status       text not null check (status in ('pass', 'warn', 'fail')),
  points       int not null check (points >= 0),
  points_max   int not null check (points_max >= points),
  points_lost  int generated always as (points_max - points) stored,
  rank         int not null,
  title        text not null,
  facts        text not null,
  fix_text     text not null default '',    -- shown in the ranked fix list
  fix_source   text not null default 'rule' check (fix_source in ('rule', 'ai')),
  unique (audit_id, check_key)
);

-- Latest score on the location itself, so lists can show it without a join.
alter table public.locations
  add column audit_score int check (audit_score between 0 and 100),
  add column audited_at  timestamptz;

-- ─────────────────────────────── Row-level security ───────────────────────────────

alter table public.audits      enable row level security;
alter table public.audit_items enable row level security;

revoke all on public.audits, public.audit_items from anon;
revoke insert, update, delete on public.audits, public.audit_items from authenticated;

create policy "audits: read if client is accessible" on public.audits
  for select to authenticated using (app.can_access_client(client_id));

create policy "audit_items: read if audit is readable" on public.audit_items
  for select to authenticated using (
    exists (select 1 from public.audits a
            where a.id = audit_id and app.can_access_client(a.client_id))
  );
