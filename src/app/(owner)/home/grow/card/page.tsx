import type { Metadata } from "next";
import { Suspense } from "react";
import { serverEnv } from "@/lib/env";
import { getOwnerContext } from "@/lib/owner/context";
import { cardPageUrl } from "@/lib/owner/links";
import { qrPngDataUrl, qrSvg } from "@/lib/owner/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { CopyButton } from "@/components/owner/copy-button";
import { Empty, Figure, NoBusiness, nf, PageHeader, Panel } from "@/components/owner/ui";

export const metadata: Metadata = { title: "Digital card" };

export default function CardSettingsPage() {
  return (
    <>
      <PageHeader
        title="Digital card"
        description="A one-page business card built from your Google profile. Share the link on WhatsApp or print the QR code. It updates itself when your profile changes."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <CardInfo />
      </Suspense>
    </>
  );
}

const KINDS = [
  { key: "view", label: "Views" },
  { key: "call", label: "Calls" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "directions", label: "Directions" },
  { key: "website", label: "Website" },
  { key: "review", label: "Review taps" },
] as const;

async function CardInfo() {
  const { business } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (business.status !== "active") {
    return (
      <Panel>
        <Empty>Your card is switched off while your account is paused.</Empty>
      </Panel>
    );
  }
  const url = cardPageUrl(serverEnv().APP_URL, business.slug);
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [svg, png, events] = await Promise.all([
    qrSvg(url, "#1b2430"),
    qrPngDataUrl(url),
    supabase
      .from("card_events")
      .select("kind")
      .eq("client_id", business.id)
      .gte("created_at", since)
      .limit(10000),
  ]);
  const count = (k: string) => (events.data ?? []).filter((e) => e.kind === k).length;

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center gap-6">
          <div
            className="size-36 shrink-0 rounded-xl bg-white p-2 [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label="QR code for your digital card"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <p className="text-ink-muted text-sm">Your card link</p>
              <p className="font-medium break-all">{url}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={url} label="Copy link" copiedLabel="Link copied" />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm font-medium"
              >
                View card
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Here are our contact details: ${url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-primary-ink rounded-lg px-3 py-1.5 text-sm font-semibold"
              >
                Share on WhatsApp
              </a>
              <a
                href={png}
                download={`${business.slug}-card-qr.png`}
                className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm font-medium"
              >
                Download QR code
              </a>
            </div>
          </div>
        </div>
      </Panel>

      <section aria-label="Last 30 days" className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Last 30 days</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {KINDS.map((k) => (
            <Figure key={k.key} label={k.label} value={nf.format(count(k.key))} />
          ))}
        </div>
      </section>
    </>
  );
}
