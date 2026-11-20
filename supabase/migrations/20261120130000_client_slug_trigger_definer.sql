-- The slug trigger calls helpers in the private `app` schema, which the server's
-- service role can't use directly. Run it with its owner's rights (auth.uid() and the
-- admin-only check still see the real caller).
alter function app.client_slug() security definer;
alter function app.slugify(text) security definer;
