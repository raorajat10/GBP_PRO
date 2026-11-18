-- M6: photos and post drafts (docs/PLAN.md §3 and §2.3).
--
-- Photos live in a PRIVATE storage bucket. Only server code (secret key) uploads or reads
-- them; the browser gets short-lived signed links. Posts are drafts in M6. Moving a post
-- past 'pending_approval' is blocked in the database until M7 adds client approvals.

-- ─────────────────────────────── Storage ───────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];
-- No storage.objects policies for this bucket: signed-in users can't list, read or write it
-- directly. All access goes through the server after a permission check.

-- ─────────────────────────────── Tables ───────────────────────────────

create table public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  storage_path  text not null unique,         -- media/<client_id>/<uuid>.jpg
  mime          text not null check (mime = 'image/jpeg'),
  width         int not null check (width >= 250),
  height        int not null check (height >= 250),
  bytes         int not null check (bytes between 10240 and 5242880),
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index media_assets_client_idx on public.media_assets (client_id);

create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade, -- for row-level security
  location_id     uuid references public.locations (id) on delete set null,
  status          text not null default 'draft' check (status in (
                    'draft', 'pending_approval', 'changes_requested',
                    'scheduled', 'publishing', 'published', 'expired', 'failed')),
  language        text not null check (language in ('en', 'hi', 'hinglish')),
  topic_type      text not null default 'STANDARD' check (topic_type in ('STANDARD', 'OFFER', 'EVENT')),
  body            text not null default '' check (char_length(body) <= 1500),
  cta_type        text check (cta_type in ('CALL', 'LEARN_MORE', 'BOOK', 'ORDER', 'SHOP', 'SIGN_UP')),
  cta_url         text check (cta_url is null or cta_url ~ '^https://'),
  media_asset_id  uuid references public.media_assets (id) on delete set null,
  source_note     text not null check (char_length(source_note) between 3 and 1000),
  ai_drafts       jsonb not null default '[]'::jsonb,  -- the drafts the AI offered, for reference
  ai_model        text,                                -- 'sample' when no AI key is set
  scheduled_for   timestamptz,
  published_at    timestamptz,
  gbp_post_name   text,
  error           text,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index posts_client_created_idx on public.posts (client_id, created_at desc);

create trigger posts_updated_at before update on public.posts
  for each row execute function app.set_updated_at();

-- Guardrail (docs/PLAN.md §0): no post is scheduled or published without client approval.
-- Approvals arrive in M7, which replaces this with a check against the approvals table.
create or replace function app.guard_post_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('scheduled', 'publishing', 'published') then
    raise exception 'A post can''t be % without client approval', new.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger posts_guard_status before insert or update of status on public.posts
  for each row execute function app.guard_post_status();

-- ─────────────────────────────── Row-level security ───────────────────────────────

alter table public.media_assets enable row level security;
alter table public.posts        enable row level security;

revoke all on public.media_assets, public.posts from anon;
revoke insert, update, delete on public.media_assets, public.posts from authenticated;

create policy "media_assets: read if client is accessible" on public.media_assets
  for select to authenticated using (app.can_access_client(client_id));

-- Team members see all posts of their clients. Owners don't see drafts in progress,
-- only posts that have been sent to them.
create policy "posts: team reads, owners read once sent" on public.posts
  for select to authenticated using (
    app.can_access_client(client_id)
    and (app.user_role() in ('admin', 'manager') or status <> 'draft')
  );
