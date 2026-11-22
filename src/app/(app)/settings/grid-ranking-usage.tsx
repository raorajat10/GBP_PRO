import { requireUser } from "@/lib/auth/dal";
import { serverEnv } from "@/lib/env";
import { scansThatFit } from "@/lib/rank/grid";
import { freeTierUsage } from "@/lib/rank/service";

const nf = new Intl.NumberFormat("en-IN");

/** Admin view of grid-ranking cost: how much of Google's free monthly allowance is used. */
export async function GridRankingUsage() {
  await requireUser(["admin"]);
  const env = serverEnv();
  const usage = await freeTierUsage();
  const live = env.RANK_PROVIDER === "google";
  const pct = usage.cap ? Math.min(100, (usage.used / usage.cap) * 100) : 100;

  return (
    <section
      aria-labelledby="grid-usage-h"
      className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5"
    >
      <div>
        <h2 id="grid-usage-h" className="text-lg font-bold">
          Grid ranking: free usage
        </h2>
        <p className="text-ink-muted text-sm">
          {live
            ? "Real Google searches. We stop at 90% of Google's free monthly amount, so this never costs money."
            : "Sample data is on (RANK_PROVIDER=mock). Nothing is sent to Google and nothing is billed."}
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">Google searches this month</dt>
          <dd className="text-xl font-bold tabular-nums">
            {nf.format(usage.used)} / {nf.format(usage.cap)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Free from Google</dt>
          <dd className="text-xl font-bold tabular-nums">{nf.format(usage.free)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Per business each month</dt>
          <dd className="text-xl font-bold tabular-nums">
            {scansThatFit(env.RANK_POINTS_PER_CLIENT_MONTH, 5)} scans
          </dd>
          <dd className="text-ink-muted text-xs">
            5 × 5, {env.RANK_POINTS_PER_CLIENT_MONTH} grid points
          </dd>
        </div>
      </dl>
      <div className="bg-paper h-2 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-ink-muted text-xs">
        Room for {nf.format(scansThatFit(usage.left, 5))} more 5 × 5 scans across all businesses
        this month. Google&apos;s allowance resets at midnight US Pacific time on the 1st. Set
        RANK_FREE_SEARCHES_PER_MONTH to 35000 only if the Google billing account has India pricing.
      </p>
    </section>
  );
}
