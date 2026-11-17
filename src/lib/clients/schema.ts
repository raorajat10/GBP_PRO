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
  };
}
