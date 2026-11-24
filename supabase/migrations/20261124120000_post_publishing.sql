-- M8: publishing approved posts to Google. Counts tries so a failing post is retried a
-- few times (with growing gaps) and then marked failed with Google's reason in posts.error.
alter table public.posts
  add column publish_attempts int not null default 0 check (publish_attempts between 0 and 10);

-- The publisher looks for due posts often; keep that cheap.
create index posts_due_idx on public.posts (scheduled_for) where status = 'scheduled';
