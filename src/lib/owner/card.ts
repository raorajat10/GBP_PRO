import "server-only";
import { getPublicClient } from "@/lib/clients/public";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { directionsLink, mobileForWhatsApp } from "./links";

/**
 * Public facts for a business's digital card at /card/<slug>. Only what the Google
 * profile already shows publicly — never the owner's private WhatsApp number.
 */
export interface PublicCard {
  clientId: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number;
  phone: string | null;
  whatsapp: string | null; // digits, only for Indian mobile numbers on the profile
  website: string | null;
  directions: string;
  hours: { day: string; open: string; close: string }[];
}

export async function getPublicCard(slug: string): Promise<PublicCard | null> {
  const client = await getPublicClient(slug);
  if (!client) return null;
  const { data: loc } = await createSupabaseAdminClient()
    .from("locations")
    .select("title, snapshot")
    .eq("client_id", client.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const s = (loc?.snapshot ?? null) as unknown as LocationSnapshot | null;
  const p = s?.profile;
  const a = p?.address;
  return {
    clientId: client.id,
    slug: client.slug,
    name: p?.title ?? client.name,
    category: p?.primaryCategory?.displayName ?? null,
    description: p?.description ?? null,
    address: a ? [...a.addressLines, a.locality, a.postalCode].filter(Boolean).join(", ") : null,
    rating: s?.reviews.average ?? null,
    reviewCount: s?.reviews.total ?? 0,
    phone: p?.phone ?? null,
    whatsapp: mobileForWhatsApp(p?.phone ?? null),
    website: p?.websiteUri ?? null,
    directions: directionsLink({ placeId: p?.placeId ?? null, title: p?.title ?? client.name }),
    hours: p?.regularHours ?? [],
  };
}

export const CARD_EVENT_KINDS = [
  "view",
  "call",
  "whatsapp",
  "directions",
  "website",
  "review",
] as const;
export type CardEventKind = (typeof CARD_EVENT_KINDS)[number];

export async function logCardEvent(clientId: string, kind: CardEventKind): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("card_events")
    .insert({ client_id: clientId, kind });
  if (error) console.error("card event", error.message);
}
