import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import type { DayOfWeek } from "@/lib/gbp/types";
import { getOwnerContext } from "@/lib/owner/context";
import { mapsLink } from "@/lib/owner/links";
import { ListSkeleton } from "@/components/skeleton";
import { ChangeRequest } from "@/components/owner/change-request";
import { ChangeRequestList } from "@/components/owner/change-request-list";
import { CopyButton } from "@/components/owner/copy-button";
import { fmtDate, NoBusiness, NoProfile, PageHeader, Panel, Pill } from "@/components/owner/ui";

export const metadata: Metadata = { title: "Business info" };

export default function ListingPage() {
  return (
    <>
      <PageHeader
        title="Business info"
        description="What customers see on your Google profile. Ask for a change and our team updates Google for you."
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Listing />
      </Suspense>
    </>
  );
}

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
];

/** "09:30" → "9:30 am" */
function time12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  if (h === 24 || (h === 0 && m === 0 && hhmm !== "00:00")) return "midnight";
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

async function Listing() {
  const { business, snapshot } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!snapshot) return <NoProfile what="Your Google business info" />;
  const p = snapshot.profile;
  const link = mapsLink(p);
  const address = p.address
    ? [...p.address.addressLines, p.address.locality, p.address.administrativeArea, p.address.postalCode]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xl font-bold">{p.title}</p>
            {address && <p className="text-ink-muted text-sm">{address}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {p.verified ? <Pill tone="success">Verified on Google</Pill> : <Pill tone="accent">Not verified yet</Pill>}
              {p.primaryCategory && <Pill tone="primary">{p.primaryCategory.displayName}</Pill>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={link} label="Copy profile link" copiedLabel="Link copied" />
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm font-medium"
            >
              Open in Google Maps
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Find ${p.title} on Google Maps: ${link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-ink rounded-lg px-3 py-1.5 text-sm font-semibold"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Basic information" actions={<ChangeRequest area="info" />}>
          <dl className="divide-line flex flex-col divide-y text-sm">
            <Row label="Business name">{p.title}</Row>
            <Row label="Phone">{p.phone ?? <Missing />}</Row>
            <Row label="Website">
              {p.websiteUri ? (
                <a href={p.websiteUri} target="_blank" rel="noopener noreferrer" className="text-primary break-all hover:underline">
                  {p.websiteUri.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <Missing />
              )}
            </Row>
            <Row label="Address">{address ?? <Missing />}</Row>
            <Row label="Opened">{p.openingDate ? fmtDate(p.openingDate) : <Missing />}</Row>
          </dl>
        </Panel>

        <Panel title="Opening hours" actions={<ChangeRequest area="hours" />}>
          {p.regularHours.length ? (
            <dl className="divide-line flex flex-col divide-y text-sm">
              {DAYS.map((d) => {
                const slots = p.regularHours.filter((h) => h.day === d.key);
                return (
                  <Row key={d.key} label={d.label}>
                    {slots.length ? (
                      slots.map((s) => `${time12(s.open)} – ${time12(s.close)}`).join(", ")
                    ) : (
                      <span className="text-ink-muted">Closed</span>
                    )}
                  </Row>
                );
              })}
            </dl>
          ) : (
            <p className="text-ink-muted text-sm">No opening hours on Google yet. Ask us to add them.</p>
          )}
          {p.specialHours.length > 0 && (
            <div className="border-line border-t pt-3 text-sm">
              <p className="font-medium">Holiday hours</p>
              <ul className="text-ink-muted mt-1">
                {p.specialHours.map((s) => (
                  <li key={s.date}>
                    {fmtDate(s.date)}: {s.closed ? "Closed" : "Special hours"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="About your business" description="The description on your profile" actions={<ChangeRequest area="info" label="Ask for a new description" />}>
          {p.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{p.description}</p>
          ) : (
            <p className="text-ink-muted text-sm">No description yet. Our team can write one for you.</p>
          )}
        </Panel>

        <Panel title="Categories" description="How Google decides which searches you appear in" actions={<ChangeRequest area="categories" />}>
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-ink-muted">Main category</p>
              <p className="font-semibold">{p.primaryCategory?.displayName ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-ink-muted">Other categories</p>
              {p.additionalCategories.length ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {p.additionalCategories.map((c) => (
                    <Pill key={c.id}>{c.displayName}</Pill>
                  ))}
                </div>
              ) : (
                <p>None yet</p>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <ChangeRequestList clientId={business.id} areas={["info", "hours", "categories"]} />
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-accent font-medium">Missing</span>;
}
