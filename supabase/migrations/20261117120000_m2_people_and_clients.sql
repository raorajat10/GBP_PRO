-- M2: people, clients and access rules.
-- Access model (docs/PLAN.md §3):
--   admin   → everything
--   manager → only clients where clients.assigned_manager_id = them
--   client  → only clients linked to them in client_users
--   no role → nothing (new accounts get no access until an admin assigns a role)

-- Private schema for helper functions; not exposed through the Data API.
create schema if not exists app;
grant usage on schema app to authenticated;

create type public.app_role as enum ('admin', 'manager', 'client');

-- ─────────────────────────────── Tables ───────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  role        public.app_role,                -- null = no access yet
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.clients (
  id                   uuid primary key default gen_random_uuid(),
  business_name        text not null check (char_length(business_name) between 1 and 200),
  owner_name           text,
  owner_whatsapp       text check (owner_whatsapp is null or owner_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_opt_in_at   timestamptz,
  preferred_language   text not null default 'en' check (preferred_language in ('en', 'hi', 'hinglish')),
  industry             text,
  brand_notes          text,
  assigned_manager_id  uuid references public.profiles (id) on delete set null,
  status               text not null default 'active' check (status in ('active', 'paused', 'churned')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index clients_assigned_manager_idx on public.clients (assigned_manager_id);

create table public.client_users (
  client_id   uuid not null references public.clients (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index client_users_user_idx on public.client_users (user_id);

-- ─────────────────────────────── Helpers ───────────────────────────────

create or replace function app.user_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function app.can_access_client(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case app.user_role()
    when 'admin' then true
    when 'manager' then exists (
      select 1 from public.clients c
      where c.id = target and c.assigned_manager_id = auth.uid())
    when 'client' then exists (
      select 1 from public.client_users cu
      where cu.client_id = target and cu.user_id = auth.uid())
    else false
  end
$$;

revoke all on function app.user_role() from public, anon;
revoke all on function app.can_access_client(uuid) from public, anon;
grant execute on function app.user_role() to authenticated;
grant execute on function app.can_access_client(uuid) to authenticated;

create or replace function app.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();
create trigger clients_updated_at before update on public.clients
  for each row execute function app.set_updated_at();

-- New auth user → profile row. The role comes only from app_metadata, which only the
-- server (secret key) can set — users cannot give themselves a role.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case when new.raw_app_meta_data ->> 'role' in ('admin', 'manager', 'client')
         then (new.raw_app_meta_data ->> 'role')::public.app_role end
  );
  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- Only an admin (or the server) may reassign a client to another manager.
create or replace function app.guard_client_reassignment()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
     and app.user_role() is distinct from 'admin'
     and new.assigned_manager_id is distinct from old.assigned_manager_id then
    raise exception 'Only an admin can reassign a client' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger clients_guard_reassignment before update on public.clients
  for each row execute function app.guard_client_reassignment();

-- ─────────────────────────────── Row-level security ───────────────────────────────

alter table public.profiles     enable row level security;
alter table public.clients      enable row level security;
alter table public.client_users enable row level security;

-- Signed-out visitors get nothing, even if a policy were later written too broadly.
revoke all on public.profiles, public.clients, public.client_users from anon;

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles: team reads team" on public.profiles
  for select to authenticated
  using ((select app.user_role()) in ('admin', 'manager') and role in ('admin', 'manager'));

create policy "profiles: admin reads all" on public.profiles
  for select to authenticated using ((select app.user_role()) = 'admin');

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Users may edit only their name and phone; role/email changes go through the server.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- clients
create policy "clients: read accessible" on public.clients
  for select to authenticated using (app.can_access_client(id));

create policy "clients: admin inserts" on public.clients
  for insert to authenticated with check ((select app.user_role()) = 'admin');

create policy "clients: admin or assigned manager updates" on public.clients
  for update to authenticated
  using (
    (select app.user_role()) = 'admin'
    or ((select app.user_role()) = 'manager' and assigned_manager_id = (select auth.uid()))
  )
  with check (
    (select app.user_role()) = 'admin'
    or ((select app.user_role()) = 'manager' and assigned_manager_id = (select auth.uid()))
  );

create policy "clients: admin deletes" on public.clients
  for delete to authenticated using ((select app.user_role()) = 'admin');

-- client_users
create policy "client_users: read own link or managed client" on public.client_users
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or ((select app.user_role()) in ('admin', 'manager') and app.can_access_client(client_id))
  );

create policy "client_users: admin inserts" on public.client_users
  for insert to authenticated with check ((select app.user_role()) = 'admin');

create policy "client_users: admin deletes" on public.client_users
  for delete to authenticated using ((select app.user_role()) = 'admin');
