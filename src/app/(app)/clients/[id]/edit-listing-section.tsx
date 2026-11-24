import type { LocationSnapshot } from "@/lib/gbp/snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListingEditForm } from "@/components/listing-edit-form";
import { editClientListingAction } from "../listing-actions";

/** Team: edit the client's live Google profile. Caller has checked access to the client. */
export async function EditListingSection({ clientId }: { clientId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: loc } = await supabase
    .from("locations")
    .select("snapshot")
    .eq("client_id", clientId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!loc) return null;
  const p = (loc.snapshot as unknown as LocationSnapshot).profile;
  if (!p) return null;

  return (
    <section
      aria-labelledby="edit-listing-h"
      className="border-line bg-surface rounded-2xl border p-5"
    >
      <details>
        <summary className="cursor-pointer">
          <h2 id="edit-listing-h" className="inline text-lg font-bold">
            Edit Google profile
          </h2>
          <span className="text-ink-muted ml-2 text-sm">
            Phone, website, description and opening hours, saved straight to Google
          </span>
        </summary>
        <div className="mt-4">
          <ListingEditForm
            action={editClientListingAction.bind(null, clientId)}
            profile={{
              phone: p.phone,
              website: p.websiteUri,
              description: p.description,
              hours: p.regularHours,
            }}
          />
        </div>
      </details>
    </section>
  );
}
