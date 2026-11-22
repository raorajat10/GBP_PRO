import type { Metadata } from "next";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { ListSkeleton } from "@/components/skeleton";
import { ChangeRequest } from "@/components/owner/change-request";
import { ChangeRequestList } from "@/components/owner/change-request-list";
import { Empty, NoBusiness, NoProfile, PageHeader, Panel } from "@/components/owner/ui";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Services"
        description="The services listed on your Google profile. Customers search for these, so list everything you offer."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Services />
      </Suspense>
    </>
  );
}

async function Services() {
  const { business, snapshot } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!snapshot) return <NoProfile what="Your services" />;
  const services = snapshot.profile.services;

  return (
    <>
      <Panel
        title={
          services.length === 1 ? "1 service on Google" : `${services.length} services on Google`
        }
        actions={
          <ChangeRequest
            area="services"
            label="Add or change services"
            placeholder="For example: add “Solar panel cleaning” and “On-grid rooftop systems”."
          />
        }
      >
        {services.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <li key={s} className="border-line rounded-xl border px-4 py-3 font-medium">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            No services on Google yet. Profiles that list their services show up in more searches.
            Tell us what you offer and we&apos;ll add them.
          </Empty>
        )}
      </Panel>
      <ChangeRequestList clientId={business.id} areas={["services"]} />
    </>
  );
}
