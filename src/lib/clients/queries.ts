import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Team members a client can be assigned to (row-level security limits what each user sees). */
export async function listManagerOptions() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["admin", "manager"])
    .order("full_name");
  return (data ?? []).map((p) => ({
    id: p.id,
    label: `${p.full_name ?? p.email}${p.role === "admin" ? " (admin)" : ""}`,
  }));
}
