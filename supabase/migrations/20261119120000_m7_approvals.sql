-- M7: client approvals for posts (docs/PLAN.md §0, §2.3, §3).
--
-- A post goes out for approval with a single-use link (only its SHA-256 hash is stored)
-- and, when the owner has agreed to WhatsApp messages, a WhatsApp template with
-- Approve / Request change buttons. Everything here is written only by server code.

create table public.approvals (
  id             uuid primary key default gen_random_uuid(),
  subject_type   text not null default 'post' check (subject_type in ('post')),
  subject_id     uuid not null references public.posts (id) on delete cascade,
  client_id      uuid not null references public.clients (id) on delete cascade, -- for row-level security
  token_hash     text not null unique,                 -- sha256(token), hex; the token itself is never stored
  channel        text not null check (channel in ('whatsapp', 'web')),
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'changes_requested', 'expired', 'cancelled')),
  response_note  text check (char_length(response_note) <= 1000),
  responded_at   timestamptz,
  responded_via  text check (responded_via in ('whatsapp', 'web')),
  wa_message_id  text,
  reminded_at    timestamptz,
  expires_at     timestamptz not null,
  sent_by        uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  check ((status in ('pending', 'expired', 'cancelled')) or responded_at is not null)
);
create index approvals_subject_idx on public.approvals (subject_id, created_at desc);
create index approvals_pending_idx on public.approvals (expires_at) where status = 'pending';
-- At most one open request per post.
create unique index approvals_one_pending_per_post on public.approvals (subject_id) where status = 'pending';

-- Every WhatsApp message we send or receive (mock or real), for support and auditing.
create table public.messages (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid references public.clients (id) on delete cascade,
  direction            text not null check (direction in ('out', 'in')),
  provider             text not null check (provider in ('mock', 'meta')),
  to_number            text,
  from_number          text,
  template_name        text,
  body                 text,
  payload              jsonb not null default '{}'::jsonb,
  provider_message_id  text unique,
  status               text not null default 'sent'
                         check (status in ('sent', 'delivered', 'read', 'failed', 'received')),
  error                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index messages_client_created_idx on public.messages (client_id, created_at desc);
create trigger messages_updated_at before update on public.messages
  for each row execute function app.set_updated_at();

-- ─────────────────────────────── Guardrails on posts ───────────────────────────────

-- Replaces the M6 placeholder: a post may be scheduled or published only when the
-- client has approved it, and approved content can't be changed afterwards.
create or replace function app.guard_post_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('scheduled', 'publishing', 'published') and not exists (
       select 1 from public.approvals a
       where a.subject_type = 'post' and a.subject_id = new.id and a.status = 'approved'
     ) then
    raise exception 'A post can''t be % without client approval', new.status
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE'
     and old.status in ('pending_approval', 'scheduled', 'publishing', 'published')
     and (new.body is distinct from old.body
          or new.media_asset_id is distinct from old.media_asset_id
          or new.cta_type is distinct from old.cta_type
          or new.cta_url is distinct from old.cta_url
          or new.topic_type is distinct from old.topic_type) then
    raise exception 'A post sent for approval can''t be edited. Ask for changes first.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Fire on content changes too, not only status changes.
drop trigger posts_guard_status on public.posts;
create trigger posts_guard_status before insert or update on public.posts
  for each row execute function app.guard_post_status();

-- ─────────────────────────────── Row-level security ───────────────────────────────

alter table public.approvals enable row level security;
alter table public.messages  enable row level security;

revoke all on public.approvals, public.messages from anon;
revoke insert, update, delete on public.approvals, public.messages from authenticated;

create policy "approvals: read if client is accessible" on public.approvals
  for select to authenticated using (app.can_access_client(client_id));

-- Message logs are for the team only.
create policy "messages: team reads their clients' messages" on public.messages
  for select to authenticated using (
    app.user_role() in ('admin', 'manager') and app.can_access_client(client_id)
  );

-- Token hashes are never needed in the browser: grant every column except token_hash.
-- (A column-level revoke can't override a table-wide grant, so grant columns explicitly.)
revoke select on public.approvals from authenticated;
grant select (id, subject_type, subject_id, client_id, channel, status, response_note,
              responded_at, responded_via, wa_message_id, reminded_at, expires_at, sent_by,
              created_at)
  on public.approvals to authenticated;

-- ─────────────────────────────── Atomic operations ───────────────────────────────
-- Called only by server code (secret key). Each runs in one transaction with row locks,
-- so a double tap, or WhatsApp and the link answering at once, can't half-apply.

-- Open an approval request and move the post to 'pending_approval'.
create or replace function public.open_post_approval(
  p_post_id uuid, p_token_hash text, p_channel text, p_expires_at timestamptz, p_sent_by uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_post public.posts%rowtype;
  v_id uuid;
begin
  select * into v_post from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'post not found' using errcode = 'no_data_found';
  end if;
  if v_post.status not in ('draft', 'changes_requested', 'expired') then
    raise exception 'post is %', v_post.status using errcode = 'check_violation';
  end if;
  if char_length(btrim(v_post.body)) = 0 then
    raise exception 'post has no text' using errcode = 'check_violation';
  end if;

  insert into public.approvals (subject_id, client_id, token_hash, channel, expires_at, sent_by)
  values (p_post_id, v_post.client_id, p_token_hash, p_channel, p_expires_at, p_sent_by)
  returning id into v_id;

  update public.posts set status = 'pending_approval' where id = p_post_id;
  return v_id;
end $$;

-- Record the owner's answer. Returns the new approval status, or the current one when
-- the request was no longer open (already answered, expired or cancelled).
create or replace function public.respond_to_post_approval(
  p_approval_id uuid, p_decision text, p_note text, p_via text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_a public.approvals%rowtype;
  v_post public.posts%rowtype;
begin
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'bad decision' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_a from public.approvals where id = p_approval_id for update;
  if not found then
    raise exception 'approval not found' using errcode = 'no_data_found';
  end if;
  if v_a.status = 'pending' and v_a.expires_at <= now() then
    update public.approvals set status = 'expired' where id = v_a.id;
    update public.posts set status = 'expired' where id = v_a.subject_id and status = 'pending_approval';
    return 'expired';
  end if;
  if v_a.status <> 'pending' then
    return v_a.status;
  end if;

  update public.approvals
     set status = p_decision, response_note = nullif(btrim(p_note), ''),
         responded_at = now(), responded_via = p_via
   where id = v_a.id;

  select * into v_post from public.posts where id = v_a.subject_id for update;
  if p_decision = 'approved' then
    update public.posts
       set status = 'scheduled',
           scheduled_for = case when scheduled_for is null or scheduled_for < now()
                                then now() else scheduled_for end
     where id = v_post.id;
  else
    update public.posts set status = 'changes_requested' where id = v_post.id;
  end if;
  return p_decision;
end $$;

-- Withdraw an open request (e.g. the manager spotted a mistake).
create or replace function public.cancel_post_approval(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.approvals set status = 'cancelled'
   where subject_id = p_post_id and status = 'pending';
  if not found then return false; end if;
  update public.posts set status = 'draft' where id = p_post_id and status = 'pending_approval';
  return true;
end $$;

-- Expire every request past its deadline. Returns the expired approvals.
create or replace function public.expire_post_approvals()
returns table (approval_id uuid, post_id uuid, client_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with expired as (
    update public.approvals a set status = 'expired'
     where a.status = 'pending' and a.expires_at <= now()
    returning a.id, a.subject_id, a.client_id
  ), posts as (
    update public.posts p set status = 'expired'
      from expired e
     where p.id = e.subject_id and p.status = 'pending_approval'
    returning p.id
  )
  select e.id, e.subject_id, e.client_id from expired e;
end $$;

revoke all on function public.open_post_approval(uuid, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.respond_to_post_approval(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_post_approval(uuid) from public, anon, authenticated;
revoke all on function public.expire_post_approvals() from public, anon, authenticated;
grant execute on function public.open_post_approval(uuid, text, text, timestamptz, uuid) to service_role;
grant execute on function public.respond_to_post_approval(uuid, text, text, text) to service_role;
grant execute on function public.cancel_post_approval(uuid) to service_role;
grant execute on function public.expire_post_approvals() to service_role;
