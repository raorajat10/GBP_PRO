import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Supabase client acting as the signed-in user (row-level security applies).
 * Use in Server Components, Server Actions and Route Handlers.
 */
export async function createSupabaseServerClient() {
  // Session checks compare token expiry with the current time, so this is request-time only.
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = publicSupabaseConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
