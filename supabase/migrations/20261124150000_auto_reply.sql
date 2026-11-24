-- Auto reply: post the ready-made thank-you on new good reviews during each sync.
-- Off for every client until switched on; only reviews written after it was switched on
-- are answered, and low ratings are always left for a person.
alter table public.clients
  add column auto_reply_since     timestamptz,                -- null = off
  add column auto_reply_min_stars smallint not null default 4
    check (auto_reply_min_stars between 3 and 5);

-- Who wrote the reply we posted: our automatic thank-you, or a team member. Null for
-- replies that were already on Google (written elsewhere).
alter table public.reviews
  add column replied_by text check (replied_by in ('auto', 'team'));
