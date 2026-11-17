import { labelFor, STATUSES } from "@/lib/clients/schema";

const styles: Record<string, string> = {
  active: "bg-primary-soft text-primary",
  paused: "bg-accent-soft text-ink",
  churned: "bg-paper text-ink-muted border border-line",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? styles.churned}`}
    >
      {labelFor(STATUSES, status) ?? status}
    </span>
  );
}
