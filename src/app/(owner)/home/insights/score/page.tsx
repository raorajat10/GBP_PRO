import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { getLatestAudit } from "@/lib/audit/service";
import { getOwnerContext } from "@/lib/owner/context";
import { breakdownRows, scoreChange } from "@/lib/owner/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { scoreBand } from "@/components/score-badge";
import { ScoreGauge } from "@/components/score-gauge";
import { BreakdownRow } from "@/components/owner/breakdown-row";
import { Empty, fmtDate, NoBusiness, NoProfile, PageHeader, Panel, Pill } from "@/components/owner/ui";
import { RecalculateButton } from "./recalculate-button";

export const metadata: Metadata = { title: "Profile score" };

export default function ScorePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Profile score" />
          <ListSkeleton rows={4} />
        </>
      }
    >
      <Score />
    </Suspense>
  );
}

const STATUS = {
  pass: { label: "Good", tone: "success" },
  warn: { label: "Could be better", tone: "accent" },
  fail: { label: "Needs work", tone: "danger" },
} as const;

async function Score() {
  const { business, location } = await getOwnerContext();
  const header = (actions?: ReactNode) => (
    <PageHeader
      title="Profile score"
      description="How complete and active your Google profile is, out of 100. A higher score usually means more calls."
      actions={actions}
    />
  );
  if (!business) return (<>{header()}<NoBusiness /></>);
  if (!location) return (<>{header()}<NoProfile what="Your profile score" /></>);
  const audit = await getLatestAudit(location.id);
  if (!audit) {
    return (
      <>
        {header()}
        <Panel>
          <Empty>Our team will check your profile soon. Your score will appear here.</Empty>
        </Panel>
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: history } = await supabase
    .from("audits")
    .select("score, created_at")
    .eq("location_id", location.id)
    .order("created_at", { ascending: false })
    .limit(8);
  const change = scoreChange(audit.score, audit.previousScore);
  const items = audit.items.map((i) => ({
    key: i.key,
    title: i.title,
    status: i.status,
    points: i.points,
    pointsMax: i.pointsMax,
    rank: i.rank,
  }));
  const toFix = audit.items.filter((i) => i.status !== "pass").sort((a, b) => a.rank - b.rank);
  const passed = audit.items.filter((i) => i.status === "pass");

  return (
    <>
      {header(<RecalculateButton />)}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Your score" description={`Checked ${fmtDate(audit.createdAt)}`}>
          <div className="flex flex-col items-center gap-2">
            <ScoreGauge score={audit.score} />
            <p className={`font-semibold ${scoreBand(audit.score).text}`}>{scoreBand(audit.score).label}</p>
            {change && (
              <p className="text-ink-muted text-sm">
                <span aria-hidden="true">{change.delta > 0 ? "▲ " : change.delta < 0 ? "▼ " : ""}</span>
                {change.label}
              </p>
            )}
          </div>
          {history && history.length > 1 && (
            <div className="border-line border-t pt-4">
              <p className="text-ink-muted mb-2 text-sm">Recent checks</p>
              <ol className="flex flex-col gap-1 text-sm">
                {history.map((h) => (
                  <li key={h.created_at} className="flex justify-between tabular-nums">
                    <span className="text-ink-muted">{fmtDate(h.created_at)}</span>
                    <span className={`font-semibold ${scoreBand(h.score).text}`}>{h.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Panel>
        <Panel title="Score breakdown" description="Points in each area">
          <ul className="flex flex-col gap-3">
            {breakdownRows(items).map((i) => (
              <BreakdownRow key={i.key} item={i} />
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="What will raise your score"
        description="Most points to win first. Our team works through these for you."
      >
        {toFix.length ? (
          <ol className="flex flex-col gap-3">
            {toFix.map((i) => (
              <li key={i.key} className="border-line rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{i.title}</p>
                  <div className="flex items-center gap-2">
                    <Pill tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Pill>
                    <span className="text-ink-muted text-sm tabular-nums">+{i.pointsLost} points possible</span>
                  </div>
                </div>
                <p className="text-ink-muted mt-1 text-sm">{i.facts}</p>
                {i.fixText && <p className="mt-2 text-sm">{i.fixText}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <Empty>Every check passes. Our team keeps it that way with regular posts and replies.</Empty>
        )}
      </Panel>

      {passed.length > 0 && (
        <Panel title="Already good">
          <ul className="flex flex-wrap gap-2">
            {passed.map((i) => (
              <li key={i.key}>
                <Pill tone="success">{i.title}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
