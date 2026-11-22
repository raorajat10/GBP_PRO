import { scoreBand } from "./score-badge";

/** Half-circle gauge for the 0–100 profile score. Pure SVG, no client JS. */
export function ScoreGauge({ score }: { score: number }) {
  const band = scoreBand(score);
  const value = Math.max(0, Math.min(100, score));
  // Knob position along the arc (180° → 0°).
  const angle = Math.PI * (1 - value / 100);
  const knob = { x: 60 + 48 * Math.cos(angle), y: 60 - 48 * Math.sin(angle) };
  return (
    <div className="relative mx-auto w-full max-w-56">
      <svg viewBox="0 0 120 68" className="w-full" aria-hidden="true">
        <path
          d="M 12 60 A 48 48 0 0 1 108 60"
          pathLength={100}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          className="stroke-line"
        />
        {value > 0 && (
          <path
            d="M 12 60 A 48 48 0 0 1 108 60"
            pathLength={100}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${value} 100`}
            className={band.stroke}
          />
        )}
        <circle
          cx={knob.x}
          cy={knob.y}
          r={6}
          strokeWidth={3}
          className={`fill-surface ${band.stroke}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <p className="leading-none">
          <span className={`text-5xl font-bold tabular-nums ${band.text}`}>{score}</span>
          <span className="text-ink-muted text-lg"> /100</span>
        </p>
      </div>
      <p className="sr-only">
        Profile score {score} out of 100, {band.label}
      </p>
    </div>
  );
}
