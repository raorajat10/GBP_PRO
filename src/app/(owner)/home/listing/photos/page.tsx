import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { ListSkeleton } from "@/components/skeleton";
import { PhotoUploadForm } from "@/components/owner/photo-upload-form";
import {
  Figure,
  fmtDate,
  NoBusiness,
  NoProfile,
  nf,
  PageHeader,
  Panel,
  Pill,
} from "@/components/owner/ui";

export const metadata: Metadata = { title: "Photos" };

const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "LOGO", label: "Logo", hint: "Shown next to your name" },
  { key: "COVER", label: "Cover photo", hint: "The first photo people see" },
  { key: "EXTERIOR", label: "Outside", hint: "Helps customers find you" },
  { key: "INTERIOR", label: "Inside", hint: "Your shop or office" },
  { key: "PRODUCT", label: "Products", hint: "What you sell" },
  { key: "AT_WORK", label: "At work", hint: "Jobs and installations" },
  { key: "TEAM", label: "Team", hint: "The people customers meet" },
  { key: "ADDITIONAL", label: "Other", hint: "Everything else" },
];

export default function PhotosPage() {
  return (
    <>
      <PageHeader
        title="Photos"
        description="Profiles with fresh photos get more calls. Send us photos and our team adds the best ones to Google."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Photos />
      </Suspense>
    </>
  );
}

async function Photos() {
  const { business, snapshot } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!snapshot) return <NoProfile what="Your photos" />;
  const ph = snapshot.photos;
  const byCat = ph.byCategory;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="Photos on Google" value={nf.format(ph.total)} />
        <Figure
          label="Added in last 30 days"
          value={nf.format(ph.last30Days)}
          tone={ph.last30Days === 0 ? "accent" : "ink"}
          note={ph.last30Days === 0 ? "Aim for a few new photos every month" : undefined}
        />
        <Figure label="Latest photo" value={ph.latest ? fmtDate(ph.latest) : "–"} />
      </div>

      <Panel
        title="Send photos to our team"
        description="We check each photo and add it to the right place on your profile."
      >
        <PhotoUploadForm
          withDate={false}
          defaultCaption="For my Google profile photos"
          submitLabel="Send photo"
        />
        <p className="text-ink-muted text-sm">
          Want a photo posted as an update instead? Use the{" "}
          <Link href="/home/grow/post-bank" className="text-primary font-medium hover:underline">
            post bank
          </Link>
          .
        </p>
      </Panel>

      <Panel title="What's on Google" description="Photos by type. Gaps are good places to start.">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const n =
              c.key === "LOGO"
                ? (byCat?.LOGO ?? (ph.hasLogo ? 1 : 0))
                : c.key === "COVER"
                  ? (byCat?.COVER ?? (ph.hasCover ? 1 : 0))
                  : byCat?.[c.key as keyof typeof byCat];
            return (
              <li key={c.key} className="border-line flex flex-col gap-1 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{c.label}</p>
                  {n === 0 ? (
                    <Pill tone="accent">Missing</Pill>
                  ) : n == null ? null : (
                    <span className="text-lg font-bold tabular-nums">{nf.format(n)}</span>
                  )}
                </div>
                <p className="text-ink-muted text-xs">{c.hint}</p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
