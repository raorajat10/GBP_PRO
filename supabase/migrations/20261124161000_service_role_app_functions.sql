-- Follow-up to 20261124160000: the clients reassignment trigger calls app.user_role(),
-- whose EXECUTE was granted only to "authenticated". Let service_role run that one function
-- too (it already bypasses row-level security, so nothing new is exposed).
grant execute on function app.user_role() to service_role;
