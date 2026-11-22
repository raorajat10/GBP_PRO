import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { requireUser, type CurrentUser } from "@/lib/auth/dal";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Remembers which business an owner with several businesses is looking at. */
export const OWNER_BUSINESS_COOKIE = "owner_business";

export interface OwnerBusiness {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface OwnerContext {
  user: CurrentUser;
  businesses: OwnerBusiness[];
  /** The business being viewed; null when the owner has none yet. */
  business: OwnerBusiness | null;
  location: { id: string; title: string; placeId: string | null; syncedAt: string } | null;
  snapshot: LocationSnapshot | null;
}

/**
 * Everything every owner page needs, read once per request as the signed-in owner
 * (row-level security limits it to their own businesses). Reads cookies: call inside Suspense.
 */
export const getOwnerContext = cache(async (): Promise<OwnerContext> => {
  const user = await requireUser(["client"]);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, business_name, slug, status")
    .order("business_name");
  const businesses: OwnerBusiness[] = (data ?? []).map((b) => ({
    id: b.id,
    name: b.business_name,
    slug: b.slug,
    status: b.status,
  }));
  const chosen = (await cookies()).get(OWNER_BUSINESS_COOKIE)?.value;
  const business = businesses.find((b) => b.id === chosen) ?? businesses[0] ?? null;
  if (!business) return { user, businesses, business: null, location: null, snapshot: null };

  const { data: loc } = await supabase
    .from("locations")
    .select("id, title, place_id, synced_at, snapshot")
    .eq("client_id", business.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return {
    user,
    businesses,
    business,
    location: loc
      ? { id: loc.id, title: loc.title, placeId: loc.place_id, syncedAt: loc.synced_at }
      : null,
    snapshot: (loc?.snapshot ?? null) as unknown as LocationSnapshot | null,
  };
});

/** The business for an owner's server action: the one they are viewing, re-checked. */
export async function requireOwnerBusiness(): Promise<{
  user: CurrentUser;
  business: OwnerBusiness;
}> {
  const ctx = await getOwnerContext();
  if (!ctx.business) throw new Error("No business is linked to this account yet.");
  return { user: ctx.user, business: ctx.business };
}
