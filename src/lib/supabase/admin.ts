import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Server-only client with the SECRET key — bypasses row-level security.
 * Use only for actions an admin has already been authorised for (e.g. creating users),
 * never with input that hasn't been checked.
 */
export function createSupabaseAdminClient() {
  const { url } = publicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
