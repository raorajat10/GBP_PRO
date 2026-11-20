-- Reply studio "where to paste" link: after the owner copies a reply draft on
-- /reply-studio/<slug>, the page opens this link (the Google page where the business
-- answers its reviews). Google addresses only, so the public page can't be turned
-- into a redirect to anywhere.

alter table public.clients
  add column reply_link text
    check (reply_link is null or (
      char_length(reply_link) <= 500 and
      reply_link ~ '^https://([a-z0-9-]+\.)*(google\.com|google\.co\.in|g\.page|goo\.gl)(/[^[:space:]]*)?$'
    ));
