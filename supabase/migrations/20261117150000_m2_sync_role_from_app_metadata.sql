-- Fix: Supabase's admin API inserts the auth user first and writes app_metadata in a
-- follow-up UPDATE, so the insert-only trigger never saw the role.
-- Rule from now on: auth.users.app_metadata.role is the single place a role is set
-- (server-side only); the database keeps profiles.role in sync with it.

create or replace function app.sync_role_from_app_metadata()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  new_role text := new.raw_app_meta_data ->> 'role';
begin
  if new_role is distinct from (old.raw_app_meta_data ->> 'role') then
    update public.profiles
       set role = case when new_role in ('admin', 'manager', 'client')
                       then new_role::public.app_role end
     where id = new.id;
  end if;
  return new;
end
$$;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function app.sync_role_from_app_metadata();
