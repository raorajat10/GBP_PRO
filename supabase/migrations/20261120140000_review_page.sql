-- Public review page (/review/<slug>): helps a customer write THEIR OWN Google review.
-- 1) Each client can store its official Google "write a review" link (until real Google
--    sync fills locations.review_url).
-- 2) Private feedback a customer chooses to send to the business instead of / as well as
--    a Google review. Every customer still gets the Google link (no review gating).

alter table public.clients
  add column google_review_link text
    check (google_review_link is null or google_review_link ~
      '^https://(search\.google\.com/local/writereview\?placeid=[A-Za-z0-9_-]+|g\.page/r/[A-Za-z0-9_-]+(/review)?)$');

create table public.review_feedback (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  rating      smallint check (rating is null or rating between 1 and 5),  -- null = no stars chosen
  message     text not null check (char_length(message) between 1 and 2000),
  contact     text check (contact is null or char_length(contact) <= 100),
  created_at  timestamptz not null default now()
);
create index review_feedback_client_idx on public.review_feedback (client_id, created_at desc);

alter table public.review_feedback enable row level security;
revoke all on public.review_feedback from anon;
-- Written only by the server (public page action); the team reads its clients' feedback.
revoke insert, update, delete on public.review_feedback from authenticated;
create policy "review_feedback: team reads their clients' feedback" on public.review_feedback
  for select to authenticated using (
    app.user_role() in ('admin', 'manager') and app.can_access_client(client_id)
  );
