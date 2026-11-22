/** Profile audit score, 0–100. Bands are shared by the client page, dashboard and owner view. */
export function scoreBand(score: number) {
  if (score >= 80)
    return {
      label: "Good",
      text: "text-success",
      ring: "border-success",
      bar: "bg-success",
      stroke: "stroke-success",
    };
  if (score >= 50)
    return {
      label: "Fair",
      text: "text-ink",
      ring: "border-accent",
      bar: "bg-accent",
      stroke: "stroke-accent",
    };
  return {
    label: "Needs work",
    text: "text-danger",
    ring: "border-danger",
    bar: "bg-danger",
    stroke: "stroke-danger",
  };
}

export function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const band = scoreBand(score);
  if (size === "sm") {
    return (
      <span
        className={`border-2 ${band.ring} ${band.text} rounded-full px-2 py-0.5 text-xs font-bold tabular-nums`}
        title={`Profile score ${score}/100 — ${band.label}`}
      >
        {score}
        <span className="sr-only"> out of 100, {band.label}</span>
      </span>
    );
  }
  return (
    <div
      className={`border-4 ${band.ring} flex size-20 shrink-0 flex-col items-center justify-center rounded-full`}
    >
      <span className={`text-2xl leading-none font-bold tabular-nums ${band.text}`}>{score}</span>
      <span className="text-ink-muted text-xs">/ 100</span>
    </div>
  );
}
