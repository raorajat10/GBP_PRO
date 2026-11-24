import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import { SiteFooter } from "./site-footer";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Readable long-form layout for the privacy policy and terms. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
        <Link href="/" className="text-primary w-fit text-sm font-semibold hover:underline">
          {brand.name}
        </Link>
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Effective {dateFmt.format(new Date(`${brand.legal.effectiveDate}T00:00:00Z`))}
          </p>
        </header>
        <article className="flex max-w-prose flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

export function ContactBlock() {
  return (
    <address className="border-line bg-surface rounded-xl border p-4 text-sm not-italic">
      <p className="font-semibold">{brand.legal.name}</p>
      <p>{brand.legal.address}</p>
      <p>
        Email:{" "}
        <a href={`mailto:${brand.legal.contactEmail}`} className="text-primary hover:underline">
          {brand.legal.contactEmail}
        </a>
      </p>
    </address>
  );
}
