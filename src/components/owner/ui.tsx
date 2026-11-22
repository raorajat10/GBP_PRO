import type { ReactNode } from "react";
import { brand } from "@/config/brand";

/** Small shared pieces for the owner portal pages. */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description && <p className="text-ink-muted mt-0.5 max-w-prose">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  id,
  className = "",
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  // Every titled panel is a named region, so screen readers (and tests) can jump to it.
  const headingId = !title
    ? undefined
    : id
      ? `${id}-h`
      : `panel-${title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-h`;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`border-line bg-surface flex scroll-mt-20 flex-col gap-4 rounded-2xl border p-5 ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 id={headingId} className="text-lg font-bold">
                {title}
              </h2>
            )}
            {description && <p className="text-ink-muted text-sm">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-ink-muted flex flex-col items-start gap-3 text-sm">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** A number with its label, for summary rows. */
export function Figure({
  label,
  value,
  note,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "ink" | "accent" | "success" | "danger";
}) {
  const color = {
    ink: "text-ink",
    accent: "text-accent",
    success: "text-success",
    danger: "text-danger",
  }[tone];
  return (
    <div className="border-line bg-surface flex flex-col gap-1 rounded-2xl border px-5 py-4">
      <p className="text-ink-muted text-sm">{label}</p>
      <p className={`text-3xl leading-tight font-bold tabular-nums ${color}`}>{value}</p>
      {note && <p className="text-ink-muted text-xs">{note}</p>}
    </div>
  );
}

export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const r = Math.round(rating);
  return (
    <span
      className={`text-accent tracking-tight ${size === "lg" ? "text-xl" : "text-sm"}`}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {"★".repeat(r)}
      <span className="text-line">{"★".repeat(5 - r)}</span>
    </span>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "accent" | "danger" | "success";
}) {
  const style = {
    muted: "bg-paper text-ink-muted border-line border",
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-ink",
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {children}
    </span>
  );
}

/** Shown on every owner page when the account has no business yet. */
export function NoBusiness() {
  return (
    <Panel>
      <Empty>Your business will appear here once our team sets it up.</Empty>
    </Panel>
  );
}

/** Shown on pages that need the Google profile before it is linked. */
export function NoProfile({ what }: { what: string }) {
  return (
    <Panel>
      <Empty>{what} will appear here once our team links your Google profile.</Empty>
    </Panel>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: brand.timeZone,
});
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: brand.timeZone,
});
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const nf = new Intl.NumberFormat("en-IN");

export const inputClass =
  "border-line bg-surface focus-visible:outline-primary w-full rounded-lg border px-3 py-2";
export const buttonPrimary =
  "bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60";
export const buttonSecondary =
  "border-line hover:bg-paper rounded-lg border px-4 py-2 font-medium disabled:opacity-60";
