import type { Metadata } from "next";
import { Suspense } from "react";
import { ATTRIBUTE_GROUPS, attributeLabel } from "@/config/attributes";
import { getOwnerContext } from "@/lib/owner/context";
import { ListSkeleton } from "@/components/skeleton";
import { ChangeRequestList } from "@/components/owner/change-request-list";
import { fmtDate, NoBusiness, NoProfile, PageHeader } from "@/components/owner/ui";
import { AttributeForm } from "./attribute-form";

export const metadata: Metadata = { title: "Attributes" };

export default function AttributesPage() {
  return (
    <>
      <PageHeader
        title="Attributes"
        description="Payments, accessibility and services that Google shows on your profile and uses in filters like “accepts UPI”."
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Attributes />
      </Suspense>
    </>
  );
}

async function Attributes() {
  const { business, snapshot } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!snapshot) return <NoProfile what="Your attributes" />;
  const current = snapshot.profile.attributes;
  // Anything Google has that our list doesn't know still gets a switch.
  const known = new Set(ATTRIBUTE_GROUPS.flatMap((g) => g.items.map((i) => i.key)));
  const extra = current.filter((k) => !known.has(k));
  const groups = extra.length
    ? [...ATTRIBUTE_GROUPS, { label: "Other", items: extra.map((k) => ({ key: k, label: attributeLabel(k) })) }]
    : ATTRIBUTE_GROUPS;

  return (
    <>
      <p className="text-ink-muted -mt-2 text-sm">
        As on Google, {fmtDate(snapshot.syncedAt)}. {current.length} switched on.
      </p>
      <AttributeForm groups={groups} current={current} />
      <ChangeRequestList clientId={business.id} areas={["attributes"]} />
    </>
  );
}
