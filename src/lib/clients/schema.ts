import { z } from "zod";

export const INDUSTRIES = [
  { value: "battery", label: "Battery / inverter dealer" },
  { value: "solar", label: "Solar installer" },
  { value: "clinic", label: "Clinic / doctor" },
  { value: "retail", label: "Shop / retail" },
  { value: "other", label: "Other" },
] as const;

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिन्दी)" },
  { value: "hinglish", label: "Hinglish" },
] as const;

export const STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "churned", label: "Left" },
] as const;

type ValueOf<T extends readonly { value: string }[]> = T[number]["value"];
export type Industry = ValueOf<typeof INDUSTRIES>;
export type Language = ValueOf<typeof LANGUAGES>;
export type ClientStatus = ValueOf<typeof STATUSES>;

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((i) => i.value) as [ValueOf<T>, ...ValueOf<T>[]];

export function labelFor(list: readonly { value: string; label: string }[], value: string | null) {
  return list.find((i) => i.value === value)?.label ?? null;
}

/**
 * Normalise a WhatsApp number to E.164. Bare 10-digit Indian mobiles get +91.
 * "98290 12345", "098290-12345", "91 9829012345", "+91 98290 12345" → "+919829012345".
 * Returns null when it can't be a valid number.
 */
export function normalizeWhatsAppNumber(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("00")) d = `+${d.slice(2)}`;
  if (d.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
  if (/^0[6-9]\d{9}$/.test(d)) d = d.slice(1);
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  return null;
}

/**
 * Link name for the public reply studio (/reply-studio/<slug>): lowercase letters,
 * numbers and single hyphens. "Sarvatra Energy" → "sarvatra-energy".
 */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null; // blank = generate from the business name (new clients only)
    const s = slugify(v);
    if (s.length < 2 || s.length > 60 || !SLUG_PATTERN.test(s)) {
      ctx.addIssue({ code: "custom", message: "Use at least 2 letters or numbers, e.g. sarvtra." });
      return z.NEVER;
    }
    return s;
  });

/** Google's official "write a review" link: the placeid form or the g.page short link. */
export const GOOGLE_REVIEW_LINK_PATTERN =
  /^https:\/\/(search\.google\.com\/local\/writereview\?placeid=[A-Za-z0-9_-]+|g\.page\/r\/[A-Za-z0-9_-]+(\/review)?)$/;

export const googleReviewLinkSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    if (!GOOGLE_REVIEW_LINK_PATTERN.test(v)) {
      ctx.addIssue({
        code: "custom",
        message:
          'Paste the link from Google\'s "Ask for reviews" button, e.g. https://g.page/r/…/review',
      });
      return z.NEVER;
    }
    return v;
  });

/**
 * Where the owner pastes a reply copied from the reply studio: any https page on a
 * Google address (Business Profile, Maps, g.page, maps.app.goo.gl). Matches the DB check.
 */
export const REPLY_LINK_PATTERN =
  /^https:\/\/([a-z0-9-]+\.)*(google\.com|google\.co\.in|g\.page|goo\.gl)(\/\S*)?$/;

export const replyLinkSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    if (v.length > 500 || !REPLY_LINK_PATTERN.test(v)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Paste a Google link (https://business.google.com/…, https://maps.app.goo.gl/… or https://g.page/…).",
      });
      return z.NEVER;
    }
    return v;
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

export const clientFormSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(1, "Business name is required.")
      .max(200, "Keep this under 200 characters."),
    ownerName: optionalText(100),
    ownerWhatsapp: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const n = normalizeWhatsAppNumber(v);
        if (!n) {
          ctx.addIssue({
            code: "custom",
            message: "Enter a valid mobile number, e.g. 98290 12345.",
          });
          return z.NEVER;
        }
        return n;
      }),
    whatsappOptIn: z.boolean(),
    preferredLanguage: z.enum(values(LANGUAGES)),
    industry: z.enum(values(INDUSTRIES)).nullable(),
    brandNotes: optionalText(2000),
    assignedManagerId: z.uuid("Pick a manager from the list.").nullable(),
    status: z.enum(values(STATUSES)),
    slug: slugSchema,
    googleReviewLink: googleReviewLinkSchema,
    replyLink: replyLinkSchema,
  })
  .refine((c) => !c.whatsappOptIn || c.ownerWhatsapp !== null, {
    path: ["whatsappOptIn"],
    message: "Add the owner's WhatsApp number before recording their consent.",
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export function parseClientForm(fd: FormData) {
  return clientFormSchema.safeParse({
    businessName: text(fd, "businessName"),
    ownerName: text(fd, "ownerName"),
    ownerWhatsapp: text(fd, "ownerWhatsapp"),
    whatsappOptIn: fd.get("whatsappOptIn") === "on",
    preferredLanguage: text(fd, "preferredLanguage") || "en",
    industry: text(fd, "industry") || null,
    brandNotes: text(fd, "brandNotes"),
    assignedManagerId: text(fd, "assignedManagerId") || null,
    status: text(fd, "status") || "active",
    slug: text(fd, "slug"),
    googleReviewLink: text(fd, "googleReviewLink"),
    replyLink: text(fd, "replyLink"),
  });
}

/**
 * Map form values to a database row. Consent keeps its original timestamp while it
 * stays ticked (so we know when it was first given) and is cleared when unticked.
 */
export function toClientRow(
  v: ClientFormValues,
  existingOptInAt: string | null,
  now: Date = new Date(),
) {
  return {
    business_name: v.businessName,
    owner_name: v.ownerName,
    owner_whatsapp: v.ownerWhatsapp,
    whatsapp_opt_in_at: v.whatsappOptIn ? (existingOptInAt ?? now.toISOString()) : null,
    preferred_language: v.preferredLanguage,
    industry: v.industry,
    brand_notes: v.brandNotes,
    assigned_manager_id: v.assignedManagerId,
    status: v.status,
    google_review_link: v.googleReviewLink,
    reply_link: v.replyLink,
    ...(v.slug ? { slug: v.slug } : {}),
  };
}
