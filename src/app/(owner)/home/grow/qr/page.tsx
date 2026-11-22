import type { Metadata } from "next";
import { Suspense } from "react";
import { serverEnv } from "@/lib/env";
import { getOwnerContext } from "@/lib/owner/context";
import { reviewPageUrl } from "@/lib/owner/links";
import { qrPngDataUrl, qrSvg } from "@/lib/owner/qr";
import { ListSkeleton } from "@/components/skeleton";
import { CopyButton } from "@/components/owner/copy-button";
import { Empty, NoBusiness, PageHeader, Panel } from "@/components/owner/ui";
import { PosterBuilder } from "./poster-builder";

export const metadata: Metadata = { title: "QR code & poster" };

export default function QrPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="QR code & review poster"
          description="Customers scan the code and land on your review page, where they can rate you and post on Google."
        />
      </div>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Qr />
      </Suspense>
    </>
  );
}

async function Qr() {
  const { business } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (business.status !== "active") {
    return (
      <Panel>
        <Empty>Your review page is switched off while your account is paused.</Empty>
      </Panel>
    );
  }
  const url = reviewPageUrl(serverEnv().APP_URL, business.slug);
  const [svg, png] = await Promise.all([qrSvg(url, "#1b2430"), qrPngDataUrl(url)]);

  return (
    <>
      <Panel className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-muted text-sm">Your review link</p>
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
              Open
            </a>
          </div>
        </div>
      </Panel>
      <Panel
        title="Poster"
        description="Change the words and colours, then print."
        className="print:border-0 print:p-0"
      >
        <PosterBuilder businessName={business.name} qrSvg={svg} pngDataUrl={png} />
      </Panel>
    </>
  );
}
