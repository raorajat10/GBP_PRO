import type { OwnerAuditItem } from "@/lib/owner/dashboard";
import { scoreBand } from "@/components/score-badge";

/** One audit area as points out of the maximum, with a coloured bar. */
export function BreakdownRow({ item }: { item: OwnerAuditItem }) {
  const pct = item.pointsMax ? Math.round((item.points / item.pointsMax) * 100) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{item.title}</span>
        <span className="tabular-nums">
          {item.points} / {item.pointsMax}
        </span>
      </div>
      <div
        className="bg-paper mt-1.5 h-2 overflow-hidden rounded-full"
        role="meter"
        aria-label={item.title}
        aria-valuemin={0}
        aria-valuemax={item.pointsMax}
        aria-valuenow={item.points}
      >
        <div className={`h-full rounded-full ${scoreBand(pct).bar}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
