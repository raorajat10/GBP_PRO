/**
 * Single source of truth for product branding.
 * The final name/domain is not decided yet — change it here and nowhere else.
 */
export const brand = {
  name: "GBP Pro",
  tagline: "More calls from Google, five minutes a week.",
  description:
    "Managed Google Business Profile growth for local businesses — we do the work, you approve on WhatsApp.",
  supportEmail: "yadupatirajat@gmail.com",
  defaultLocale: "en-IN",
  timeZone: "Asia/Kolkata",
  /** The company behind the service, shown on the privacy policy and terms. */
  legal: {
    name: "Sarvatra Energy Private Limited",
    address: "Shop No-6, Tonk Road, Sitapura, Jaipur, Rajasthan 302022, India",
    contactEmail: "yadupatirajat@gmail.com",
    grievanceOfficer: "Grievance Officer, Sarvatra Energy Private Limited",
    city: "Jaipur",
    /** Date the current policy and terms took effect (update when they change). */
    effectiveDate: "2026-11-24",
  },
} as const;

export type Brand = typeof brand;
