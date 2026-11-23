import "server-only";
import { z } from "zod";
import { recordAudit } from "@/lib/audit/service";
import { decryptToken, encryptToken, parseKey } from "@/lib/crypto/tokens";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getGbpProvider } from "./provider";
import { saveProfileHistory } from "./history";
import { collectProfile } from "./snapshot";
import { GbpError, type ConnectMode, type GbpCredentials, type GbpProviderKind } from "./types";

/**
 * Server-only Google Business Profile operations. These use the secret-key client (the
 * credentials table is locked to everyone else), so EVERY exported function here must be
 * called only after the caller's permission has been checked.
 */

type ConnectionRow = Database["public"]["Tables"]["gbp_connections"]["Row"];

const dbMode = (mode: ConnectMode) => (mode === "agency" ? "agency_manager" : "owner_oauth");

const tokenKey = () => parseKey(serverEnv().TOKEN_ENCRYPTION_KEY);

/** Sample connections have no token; real ones store it encrypted (src/lib/crypto/tokens.ts). */
function credsOf(conn: ConnectionRow): GbpCredentials {
  return {
    accountName: conn.google_account_name,
    refreshToken: conn.refresh_token_encrypted
      ? decryptToken(conn.refresh_token_encrypted, tokenKey())
      : null,
  };
}

/** Google said our access is gone: flag the connection so the team sees "reconnect". */
async function flagConnection(connectionId: string, e: unknown) {
  if (!(e instanceof GbpError) || e.kind !== "auth") return;
  await createSupabaseAdminClient()
    .from("gbp_connections")
    .update({ status: "error", last_error: e.message })
    .eq("id", connectionId);
}

/** True if the signed-in user is admin, or the manager assigned to this client (row-level security decides). */
export async function canManageClient(clientId: string, role: string | null): Promise<boolean> {
  if (role !== "admin" && role !== "manager") return false;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  return Boolean(data);
}

/** Location must belong to this client — never trust ids from the browser. */
export async function locationBelongsTo(locationId: string, clientId: string): Promise<boolean> {
  if (!z.uuid().safeParse(locationId).success) return false;
  const { data } = await createSupabaseAdminClient()
    .from("locations")
    .select("client_id")
    .eq("id", locationId)
    .maybeSingle();
  return data?.client_id === clientId;
}

export async function getAgencyConnection(): Promise<ConnectionRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("gbp_connections")
    .select("*")
    .eq("mode", "agency_manager")
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function saveConnection(input: {
  provider: GbpProviderKind;
  mode: ConnectMode;
  clientId: string | null;
  accountName: string;
  label: string;
  userId: string | null; // null when the owner connected through an invite link
  refreshToken?: string | null; // real Google connections only; stored encrypted
}): Promise<ConnectionRow> {
  const admin = createSupabaseAdminClient();
  if (input.provider === "google" && !input.refreshToken) {
    throw new GbpError("Google didn't give us lasting access. Connect again.", "auth");
  }
  const { data, error } = await admin
    .from("gbp_connections")
    .upsert(
      {
        provider: input.provider,
        mode: dbMode(input.mode),
        client_id: input.clientId,
        google_account_name: input.accountName,
        google_account_label: input.label,
        refresh_token_encrypted: input.refreshToken
          ? encryptToken(input.refreshToken, tokenKey())
          : null,
        status: "connected",
        last_error: null,
        connected_by: input.userId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "provider,google_account_name,client_id" },
    )
    .select("*")
    .single();
  if (error || !data) throw new GbpError(`Couldn't save the connection: ${error?.message}`);
  return data;
}

export interface LinkCandidateGroup {
  connectionId: string;
  label: string;
  mode: "agency_manager" | "owner_oauth";
  locations: { name: string; title: string; area: string | null }[];
  error?: string;
}

/** Google profiles this client could be linked to: via the team account and the client's own owner connections. */
export async function listLinkCandidates(clientId: string): Promise<LinkCandidateGroup[]> {
  if (!z.uuid().safeParse(clientId).success) return []; // also guards the filter string below
  const admin = createSupabaseAdminClient();
  const { data: connections } = await admin
    .from("gbp_connections")
    .select("*")
    .eq("status", "connected")
    .or(`mode.eq.agency_manager,client_id.eq.${clientId}`)
    .order("mode");
  if (!connections?.length) return [];

  const { data: linked } = await admin.from("locations").select("gbp_location_name");
  const taken = new Set((linked ?? []).map((l) => l.gbp_location_name));

  return Promise.all(
    connections.map(async (conn) => {
      const group: LinkCandidateGroup = {
        connectionId: conn.id,
        label: conn.google_account_label ?? conn.google_account_name,
        mode: conn.mode as LinkCandidateGroup["mode"],
        locations: [],
      };
      try {
        const locations = await getGbpProvider(conn.provider as GbpProviderKind).listLocations(
          credsOf(conn),
        );
        group.locations = locations
          .filter((l) => !taken.has(l.name))
          .map((l) => ({
            name: l.name,
            title: l.title,
            area: l.address?.addressLines.at(-1) ?? null,
          }));
      } catch (e) {
        group.error = e instanceof GbpError ? e.message : "Couldn't load profiles from Google.";
      }
      return group;
    }),
  );
}

/** Link a Google profile to a client and take the first snapshot. */
export async function linkLocation(input: {
  clientId: string;
  connectionId: string;
  locationName: string;
  userId?: string | null;
}): Promise<{ locationId: string }> {
  const admin = createSupabaseAdminClient();
  const { data: conn } = await admin
    .from("gbp_connections")
    .select("*")
    .eq("id", input.connectionId)
    .eq("status", "connected")
    .maybeSingle();
  if (!conn) throw new GbpError("That Google connection no longer exists.", "not_found");
  if (conn.mode === "owner_oauth" && conn.client_id !== input.clientId) {
    throw new GbpError("That owner connection belongs to a different client.", "auth");
  }

  const provider = getGbpProvider(conn.provider as GbpProviderKind);
  // The profile must be one this connection manages; that also tells us which Google
  // account (personal or a location group) it sits in, which some API calls need.
  const base = credsOf(conn);
  const listed = (await provider.listLocations(base)).find((l) => l.name === input.locationName);
  if (!listed) {
    throw new GbpError("That profile isn't managed by this Google account.", "not_found");
  }
  const creds = { ...base, accountName: listed.accountName };
  let collected;
  try {
    collected = await collectProfile(provider, creds, input.locationName);
  } catch (e) {
    await flagConnection(conn.id, e);
    throw e;
  }
  const { snapshot, reviews, metrics } = collected;
  const p = snapshot.profile;

  const { data, error } = await admin
    .from("locations")
    .insert({
      client_id: input.clientId,
      connection_id: conn.id,
      gbp_account_name: listed.accountName,
      gbp_location_name: p.name,
      title: p.title,
      place_id: p.placeId,
      primary_category: p.primaryCategory?.displayName ?? null,
      address: p.address as unknown as Json,
      phone: p.phone,
      website: p.websiteUri,
      snapshot: snapshot as unknown as NonNullable<Json>,
      synced_at: snapshot.syncedAt,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    throw new GbpError("This Google profile is already linked to a client.", "unknown");
  }
  if (error || !data) throw new GbpError("Couldn't link the profile. Try again.");
  await historyQuietly({
    locationId: data.id,
    clientId: input.clientId,
    reviews,
    metrics,
    notifyNewReviews: false,
  });
  await auditQuietly({
    locationId: data.id,
    clientId: input.clientId,
    snapshot,
    userId: input.userId,
  });
  return { locationId: data.id };
}

/** Re-read a linked profile from Google and refresh its snapshot. */
export async function syncLocation(locationId: string, userId?: string | null): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: loc } = await admin
    .from("locations")
    .select("id, client_id, gbp_account_name, gbp_location_name, connection:gbp_connections(*)")
    .eq("id", locationId)
    .single();
  if (!loc?.connection) throw new GbpError("Linked profile not found.", "not_found");
  const conn = loc.connection as ConnectionRow;

  let collected;
  try {
    collected = await collectProfile(
      getGbpProvider(conn.provider as GbpProviderKind),
      { ...credsOf(conn), accountName: loc.gbp_account_name },
      loc.gbp_location_name,
    );
  } catch (e) {
    await flagConnection(conn.id, e);
    throw e;
  }
  const { snapshot, reviews, metrics } = collected;
  const p = snapshot.profile;
  const { error } = await admin
    .from("locations")
    .update({
      title: p.title,
      place_id: p.placeId,
      primary_category: p.primaryCategory?.displayName ?? null,
      address: p.address as unknown as Json,
      phone: p.phone,
      website: p.websiteUri,
      snapshot: snapshot as unknown as NonNullable<Json>,
      synced_at: snapshot.syncedAt,
    })
    .eq("id", locationId);
  if (error) throw new GbpError("Couldn't save the refreshed profile.");
  await historyQuietly({
    locationId,
    clientId: loc.client_id,
    reviews,
    metrics,
    notifyNewReviews: true,
  });
  await auditQuietly({ locationId, clientId: loc.client_id, snapshot, userId });
}

/** Reviews and daily numbers are extras on top of the saved snapshot: log failures, don't show them. */
async function historyQuietly(input: Parameters<typeof saveProfileHistory>[0]) {
  try {
    await saveProfileHistory(input);
  } catch (e) {
    console.error("Saving review/metric history failed", e);
  }
}

/** Re-score after every link/sync. The profile data is already saved, so an audit failure is logged, not shown. */
async function auditQuietly(input: Parameters<typeof recordAudit>[0]) {
  try {
    await recordAudit(input);
  } catch (e) {
    console.error("Audit after sync failed", e);
  }
}

export async function unlinkLocation(locationId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("locations").delete().eq("id", locationId);
  if (error) throw new GbpError("Couldn't unlink the profile.");
}
