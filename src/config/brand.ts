/**
 * Single source of truth for product branding.
 * The final name/domain is not decided yet — change it here and nowhere else.
 */
export const brand = {
  name: "GBP Pro",
  tagline: "More calls from Google, five minutes a week.",
  description:
    "Managed Google Business Profile growth for local businesses — we do the work, you approve on WhatsApp.",
  supportEmail: "support@example.com", // TODO: replace once the domain is confirmed
  defaultLocale: "en-IN",
  timeZone: "Asia/Kolkata",
} as const;

export type Brand = typeof brand;
