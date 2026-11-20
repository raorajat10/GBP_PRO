-- Public reply studio: every client gets a link name (slug) for /reply-studio/<slug>.
-- Generated from the business name when the client is created (e.g. "Sarvatra Energy"
-- → "sarvatra-energy", then "-2", "-3" if taken). It does NOT change when the business
-- is renamed, so links already shared keep working. Only an admin can change it.

alter table public.clients add column slug text;

create or replace function app.slugify(input text)
returns text language sql immutable set search_path = ''
as $$
  select left(trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g')), 50)
$$;

create or replace function app.unique_client_slug(base text, exclude_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  root text := trim(both '-' from coalesce(nullif(base, ''), 'client'));
  candidate text := root;
  n int := 1;
begin
  if char_length(root) < 2 then root := 'client'; candidate := root; end if;
  while exists (
    select 1 from public.clients c
    where c.slug = candidate and c.id is distinct from exclude_id
  ) loop
    n := n + 1;
    candidate := root || '-' || n;
  end loop;
  return candidate;
end
$$;

-- Backfill existing clients, oldest first so the first business keeps the plain name.
do $$
declare r record;
begin
  for r in select id, business_name from public.clients order by created_at, id loop
    update public.clients
      set slug = app.unique_client_slug(app.slugify(r.business_name), r.id)
      where id = r.id;
  end loop;
end
$$;

alter table public.clients
  alter column slug set not null,
  add constraint clients_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  add constraint clients_slug_key unique (slug);

-- Fill the slug on insert when none is given; only admins (or the server) may change it.
create or replace function app.client_slug()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null or new.slug = '' then
      new.slug := app.unique_client_slug(app.slugify(new.business_name), new.id);
    end if;
  elsif new.slug is distinct from old.slug
        and auth.uid() is not null
        and app.user_role() is distinct from 'admin' then
    raise exception 'Only an admin can change the reply studio link' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger clients_slug before insert or update on public.clients
  for each row execute function app.client_slug();
