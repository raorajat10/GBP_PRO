const MESSAGES: Record<string, { tone: "ok" | "info" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Team Google account connected." },
  linked: { tone: "ok", text: "Google profile linked and synced." },
  unlinked: { tone: "info", text: "Google profile unlinked from this client." },
  choose: {
    tone: "info",
    text: "Owner's Google account connected. Pick which profile belongs to this client below.",
  },
  cancelled: { tone: "info", text: "Connection cancelled — nothing was changed." },
  expired: { tone: "error", text: "That connection attempt expired. Please try again." },
  forbidden: { tone: "error", text: "You don't have permission to do that." },
  "no-profiles": {
    tone: "error",
    text: "That Google account doesn't manage any business profiles.",
  },
  "not-enabled": {
    tone: "error",
    text: "The real Google connection isn't switched on yet — it will be once Google approves our API access.",
  },
  error: { tone: "error", text: "Something went wrong connecting to Google. Please try again." },
};

const toneClass = {
  ok: "border-primary bg-primary-soft text-ink",
  info: "border-line bg-surface text-ink",
  error: "border-danger bg-surface text-danger",
};

export function GbpStatusBanner({ status }: { status: string | string[] | undefined }) {
  const key = Array.isArray(status) ? status[0] : status;
  const msg = key ? MESSAGES[key] : undefined;
  if (!msg) return null;
  return (
    <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${toneClass[msg.tone]}`}>
      {msg.text}
    </p>
  );
}
