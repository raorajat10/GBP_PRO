"use client";

import { useId, useState } from "react";

const SCHEMES = [
  { key: "teal", label: "Teal", bg: "#0e3a33", ink: "#ffffff", accent: "#f2a33a" },
  { key: "marigold", label: "Marigold", bg: "#f2a33a", ink: "#1b2430", accent: "#0e3a33" },
  { key: "white", label: "White", bg: "#ffffff", ink: "#1b2430", accent: "#0f6e5c" },
] as const;

/** Printable "review us" poster with the owner's own words and a QR to their review page. */
export function PosterBuilder({
  businessName,
  qrSvg,
  pngDataUrl,
}: {
  businessName: string;
  qrSvg: string;
  pngDataUrl: string;
}) {
  const [title, setTitle] = useState("Happy with our work?");
  const [line, setLine] = useState("Scan to leave us a Google review. It takes a minute.");
  const [scheme, setScheme] = useState<(typeof SCHEMES)[number]>(SCHEMES[0]);
  const ids = { title: useId(), line: useId() };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.title} className="text-sm font-medium">
            Heading
          </label>
          <input
            id={ids.title}
            value={title}
            maxLength={50}
            onChange={(e) => setTitle(e.target.value)}
            className="border-line bg-surface rounded-lg border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.line} className="text-sm font-medium">
            Message
          </label>
          <textarea
            id={ids.line}
            value={line}
            maxLength={100}
            rows={2}
            onChange={(e) => setLine(e.target.value)}
            className="border-line bg-surface rounded-lg border px-3 py-2"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Colours</legend>
          <div className="flex flex-wrap gap-2">
            {SCHEMES.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  scheme.key === s.key
                    ? "border-primary bg-primary-soft font-semibold"
                    : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="scheme"
                  className="sr-only"
                  checked={scheme.key === s.key}
                  onChange={() => setScheme(s)}
                />
                <span
                  className="border-line size-4 rounded-full border"
                  style={{ background: s.bg }}
                  aria-hidden="true"
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold"
          >
            Print poster
          </button>
          <a
            href={pngDataUrl}
            download={`${businessName.replace(/[^\w]+/g, "-").toLowerCase()}-review-qr.png`}
            className="border-line hover:bg-paper rounded-lg border px-4 py-2 font-medium"
          >
            Download QR code
          </a>
        </div>
        <p className="text-ink-muted text-sm">
          Tip: print it at A5 or A4 and put it at your counter, on invoices, or hand it over after a
          job.
        </p>
      </div>

      <div
        className="mx-auto flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-between rounded-2xl p-8 text-center print:max-w-none print:rounded-none"
        style={{
          background: scheme.bg,
          color: scheme.ink,
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
        aria-label="Poster preview"
      >
        <div>
          <p className="text-lg font-semibold opacity-90">{businessName}</p>
          <p className="mt-3 text-3xl leading-tight font-bold">{title || " "}</p>
          <p
            className="mt-1 text-2xl tracking-widest"
            style={{ color: scheme.accent }}
            aria-hidden="true"
          >
            ★★★★★
          </p>
        </div>
        <div
          className="w-3/5 rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-base leading-snug">{line}</p>
      </div>
    </div>
  );
}
