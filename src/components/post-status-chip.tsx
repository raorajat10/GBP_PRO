const STATUS: Record<string, { label: string; style: string }> = {
  draft: { label: "Draft", style: "bg-paper text-ink-muted border border-line" },
  pending_approval: { label: "Waiting for owner", style: "bg-accent-soft text-ink" },
  changes_requested: { label: "Changes requested", style: "bg-accent-soft text-ink" },
  scheduled: { label: "Scheduled", style: "bg-primary-soft text-primary" },
  publishing: { label: "Publishing", style: "bg-primary-soft text-primary" },
  published: { label: "Live", style: "bg-primary-soft text-primary" },
  expired: { label: "Expired", style: "bg-paper text-ink-muted border border-line" },
  failed: { label: "Failed", style: "bg-danger/10 text-danger" },
};

export function PostStatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.style}`}>{s.label}</span>
  );
}

export const LANGUAGE_SHORT: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  hinglish: "Hinglish",
};

export function SampleBadge() {
  return (
    <span
      className="bg-accent-soft rounded px-1.5 py-0.5 text-xs font-semibold"
      title="Written from a template because no Anthropic API key is set"
    >
      Sample draft
    </span>
  );
}
