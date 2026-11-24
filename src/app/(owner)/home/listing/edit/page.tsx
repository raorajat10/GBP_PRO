import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { ListSkeleton } from "@/components/skeleton";
import { ListingEditForm } from "@/components/listing-edit-form";
import { NoBusiness, NoProfile, PageHeader, Panel } from "@/components/owner/ui";
import { editOwnListingAction } from "./actions";

export const metadata: Metadata = { title: "Edit business info" };

export default function EditListingPage() {
  return (
    <>
      <PageHeader
        title="Edit business info"
        description="Change your phone, website, description and opening hours. Saving updates your Google profile directly."
        actions={
          <Link href="/home/listing" className="text-primary text-sm font-medium hover:underline">
            Back to business info
          </Link>
        }
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Edit />
      </Suspense>
    </>
  );
}

async function Edit() {
  const { business, snapshot } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!snapshot) return <NoProfile what="Editing" />;
  const p = snapshot.profile;
  return (
    <Panel>
      <ListingEditForm
        action={editOwnListingAction}
        profile={{
          phone: p.phone,
          website: p.websiteUri,
          description: p.description,
          hours: p.regularHours,
        }}
      />
      <p className="text-ink-muted text-sm">
        Categories, services and attributes are changed by our team: use &quot;Ask for a
        change&quot; on the business info page.
      </p>
    </Panel>
  );
}
