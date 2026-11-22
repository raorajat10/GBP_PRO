/** Support ticket choices, shared by the owner form, the team view and validation. */

export const TICKET_CATEGORIES = [
  { value: "google_profile", label: "My Google profile" },
  { value: "reviews", label: "Reviews" },
  { value: "posts", label: "Posts" },
  { value: "billing", label: "Billing" },
  { value: "other", label: "Something else" },
] as const;

export const TICKET_PRIORITIES = [
  { value: "low", label: "Whenever you can" },
  { value: "medium", label: "Soon" },
  { value: "high", label: "Urgent" },
] as const;

export const TICKET_STATUS = {
  open: { label: "Open", tone: "accent" },
  in_progress: { label: "Our team is on it", tone: "primary" },
  resolved: { label: "Resolved", tone: "success" },
} as const;

export const labelOf = (list: readonly { value: string; label: string }[], v: string) =>
  list.find((x) => x.value === v)?.label ?? v;

export const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I approve a post?",
    a: "When a post is ready, we send you a WhatsApp message with a link. Open it, read the post, and tap Approve or ask for changes. Nothing goes on Google without your OK.",
  },
  {
    q: "Who replies to my Google reviews?",
    a: "Our team replies to every review for you, in your business's voice. You can see the replies on the Google reviews page.",
  },
  {
    q: "How do I change my opening hours or phone number?",
    a: "Open Business info, press “Ask for a change” next to the section, and tell us what's new. We update Google and let you know.",
  },
  {
    q: "How do I get more reviews?",
    a: "Share your review link on WhatsApp after every job, and print the QR poster for your counter. Both are under Grow.",
  },
  {
    q: "Why did my score go down?",
    a: "The score drops when the profile goes quiet: no new photos, posts or reviews for a while. The Profile score page shows exactly what to fix first.",
  },
];
