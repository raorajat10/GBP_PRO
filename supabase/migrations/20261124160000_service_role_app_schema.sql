-- Server code (service_role) couldn't update public.clients: its triggers call functions in
-- the "app" schema, and only "authenticated" had been granted usage on it. service_role
-- already bypasses row-level security, so this exposes nothing new; it lets triggers run.
grant usage on schema app to service_role;
