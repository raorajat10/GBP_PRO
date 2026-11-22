import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { brand } from "@/config/brand";
import { getPublicCard } from "@/lib/owner/card";
import { ViewBeacon } from "./view-beacon";

export const metadata: Metadata = {
  title: "Business card",
  robots: { index: false, follow: false },
};

/** Public digital business card for an active client, e.g. /card/sarvatra. */
export default function CardPage({ params }: PageProps<"/card/[slug]">) {
  return (
    <main className="bg-paper flex min-h-dvh justify-center px-4 py-8">
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        {params.then(({ slug }) => (
          <Card slug={slug} />
        ))}
      </Suspense>
    </main>
  );
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};
const ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function t12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const hour = h % 12 || 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 && h < 24 ? "pm" : "am"}`;
}

async function Card({ slug }: { slug: string }) {
  const card = await getPublicCard(slug);
  if (!card) notFound();
  const todayName =
    DAY_NAMES[new Date(new Date().toLocaleString("en-US", { timeZone: brand.timeZone })).getDay()];
  const today = card.hours.filter((h) => h.day === todayName);
  const go = (to: string) => `/card/${encodeURIComponent(card.slug)}/go?to=${to}`;

  return (
    <article className="bg-surface border-line flex w-full max-w-md flex-col self-start overflow-hidden rounded-3xl border">
      <ViewBeacon slug={card.slug} />
      <header className="bg-rail text-rail-ink flex flex-col gap-4 px-6 pt-8 pb-6">
        <div className="bg-accent text-ink flex size-16 items-center justify-center rounded-2xl text-3xl font-bold">
          {card.name.trim().charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl leading-tight font-bold">{card.name}</h1>
          {card.category && <p className="text-rail-muted">{card.category}</p>}
        </div>
        {card.rating != null && (
          <p className="flex items-center gap-2">
            <span className="text-accent text-lg" aria-hidden="true">
              ★
            </span>
            <span className="font-semibold">{card.rating}</span>
            <span className="text-rail-muted text-sm">
              from {card.reviewCount} Google {card.reviewCount === 1 ? "review" : "reviews"}
            </span>
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-px bg-[var(--line)]">
        {card.phone && <Action href={go("call")} label="Call" icon={<PhoneIcon />} />}
        {card.whatsapp && (
          <Action href={go("whatsapp")} label="WhatsApp" icon={<ChatIcon />} external />
        )}
        <Action href={go("directions")} label="Directions" icon={<PinIcon />} external />
        {card.website && (
          <Action href={go("website")} label="Website" icon={<GlobeIcon />} external />
        )}
      </div>

      <div className="flex flex-col gap-5 px-6 py-6">
        {card.description && <p className="text-sm leading-relaxed">{card.description}</p>}
        {card.address && (
          <div>
            <p className="text-ink-muted text-sm">Address</p>
            <p>{card.address}</p>
          </div>
        )}
        {card.hours.length > 0 && (
          <div>
            <p className="text-ink-muted text-sm">
              Today:{" "}
              <span className="text-ink font-semibold">
                {today.length
                  ? today.map((h) => `${t12(h.open)} – ${t12(h.close)}`).join(", ")
                  : "Closed"}
              </span>
            </p>
            <details className="mt-1 text-sm">
              <summary className="text-primary cursor-pointer">All opening hours</summary>
              <dl className="mt-2 grid grid-cols-[3rem_1fr] gap-y-1">
                {ORDER.map((d) => {
                  const slots = card.hours.filter((h) => h.day === d);
                  return (
                    <div key={d} className="contents">
                      <dt className={d === todayName ? "font-semibold" : "text-ink-muted"}>
                        {DAY_LABEL[d]}
                      </dt>
                      <dd className={d === todayName ? "font-semibold" : ""}>
                        {slots.length
                          ? slots.map((h) => `${t12(h.open)} – ${t12(h.close)}`).join(", ")
                          : "Closed"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </details>
          </div>
        )}
        <a
          href={go("review")}
          className="bg-accent text-ink rounded-xl px-4 py-3 text-center font-bold"
        >
          Rate us on Google
        </a>
      </div>
      <footer className="border-line text-ink-muted border-t px-6 py-3 text-center text-xs">
        Digital card by {brand.name}
      </footer>
    </article>
  );
}

function Action({
  href,
  label,
  icon,
  external,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="bg-surface hover:bg-primary-soft text-primary flex flex-col items-center gap-1.5 py-4 font-semibold"
    >
      {icon}
      <span className="text-ink text-sm">{label}</span>
    </a>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  className: "size-6",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const PhoneIcon = () => (
  <svg {...iconProps}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
const ChatIcon = () => (
  <svg {...iconProps}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);
const PinIcon = () => (
  <svg {...iconProps}>
    <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
const GlobeIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
  </svg>
);
