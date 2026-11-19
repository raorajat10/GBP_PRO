-- Owner connect invites: the team sends a business owner a private link; the owner signs
-- in with Google and approves access to their Business Profile, which is then linked to
-- that client. Only the SHA-256 hash of the link's token is stored. Server-only writes.

create table public.connect_invites (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  token_hash     text not null unique,
  sent_to_email  text check (sent_to_email is null or sent_to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_status   text not null default 'not_sent' check (email_status in ('not_sent', 'sent', 'failed')),
  status         text not null default 'pending' check (status in ('pending', 'used', 'cancelled')),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  connection_id  uuid references public.gbp_connections (id) on delete set null,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index connect_invites_client_idx on public.connect_invites (client_id, created_at desc);

-- Allow an owner connection made through an invite (no team member signed in).
-- (gbp_connections.connected_by is already nullable.)

alter table public.connect_invites enable row level security;
revoke all on public.connect_invites from anon;
revoke insert, update, delete on public.connect_invites from authenticated;

-- Team only; token hashes never readable in the browser.
revoke select on public.connect_invites from authenticated;
grant select (id, client_id, sent_to_email, email_status, status, expires_at, used_at,
              connection_id, created_by, created_at)
  on public.connect_invites to authenticated;
create policy "connect_invites: team reads their clients' invites" on public.connect_invites
  for select to authenticated using (
    app.user_role() in ('admin', 'manager') and app.can_access_client(client_id)
  );
