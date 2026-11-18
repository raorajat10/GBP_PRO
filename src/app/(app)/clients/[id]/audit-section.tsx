import { aiWritingEnabled, getLatestAudit, type AuditView } from "@/lib/audit/service";
import { ActionForm } from "@/components/action-form";
import { ScoreBadge, scoreBand } from "@/components/score-badge";
import { runAuditAction, wordAuditAction } from "../audit-actions";

const statusStyle = {
  fail: "bg-danger/10 text-danger",
  warn: "bg-accent-soft text-ink",
  pass: "bg-primary-soft text-primary",
} as const;
const statusLabel = { fail: "Fix first", warn: "Improve", pass: "Done" } as const;

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** Caller must already have checked the user can manage this client. */
export async function AuditSection({
  clientId,
  locationId,
}: {
  clientId: string;
  locationId: string;
}) {
  const audit = await getLatestAudit(locationId);
  return (
    <section
      aria-labelledby="audit-heading"
      className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5"
    >
      <h2 id="audit-heading" className="text-lg font-semibold">
        Profile audit
      </h2>
      {audit ? (
        <AuditBody clientId={clientId} locationId={locationId} audit={audit} />
      ) : (
        <>
          <p className="text-ink-muted text-sm">
            No audit yet. Run one to score this profile and get a ranked list of fixes.
          </p>
          <ActionForm
            action={runAuditAction.bind(null, clientId, locationId)}
            label="Run audit"
            pendingLabel="Scoring…"
            variant="primary"
          />
        </>
      )}
    </section>
  );
}

function AuditBody({
  clientId,
  locationId,
  audit,
}: {
  clientId: string;
  locationId: string;
  audit: AuditView;
}) {
  const open = audit.items.filter((i) => i.status !== "pass");
  const done = audit.items.filter((i) => i.status === "pass");
  const band = scoreBand(audit.score);
  const delta = audit.previousScore === null ? null : audit.score - audit.previousScore;
  const canWord = aiWritingEnabled();
  const hasAi = open.some((i) => i.fixSource === "ai");

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <ScoreBadge score={audit.score} size="lg" />
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <p className="font-semibold">
            {band.label}
            {delta !== null && delta !== 0 && (
              <span className={`ml-2 text-sm ${delta > 0 ? "text-success" : "text-danger"}`}>
                {delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`} since last audit
              </span>
            )}
          </p>
          <div aria-hidden className="bg-paper border-line h-2 overflow-hidden rounded-full border">
            <div className={`h-full ${band.bar}`} style={{ width: `${audit.score}%` }} />
          </div>
          <p className="text-ink-muted text-xs">
            Based on profile data synced {dateFmt.format(new Date(audit.snapshotSyncedAt))}.
            {open.length > 0 && ` Fixing everything below adds up to ${100 - audit.score} points.`}
          </p>
        </div>
      </div>

      {open.length > 0 ? (
        <ol className="flex flex-col gap-2" aria-label="Fixes, most important first">
          {open.map((i) => (
            <li
              key={i.key}
              className="border-line bg-paper flex flex-col gap-1 rounded-xl border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ink-muted w-5 text-sm tabular-nums">{i.rank}.</span>
                <span className="font-semibold">{i.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[i.status]}`}
                >
                  {statusLabel[i.status]}
                </span>
                <span className="text-ink-muted ml-auto text-sm tabular-nums">
                  +{i.pointsLost} pts possible
                </span>
              </div>
              <p className="text-ink-muted pl-7 text-sm">{i.facts}</p>
              <p className="pl-7 text-sm">
                {i.fixSource === "ai" && (
                  <span className="bg-primary-soft text-primary mr-1.5 rounded px-1.5 py-0.5 text-xs font-semibold">
                    AI
                  </span>
                )}
                {i.fixText}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-success text-sm font-medium">Every check passes. Nice work.</p>
      )}

      {audit.suggestedDescription && (
        <div className="flex flex-col gap-1">
          <label htmlFor="suggested-description" className="text-sm font-medium">
            Suggested description{" "}
            <span className="text-ink-muted font-normal">
              (AI draft — check the facts with the owner before using it)
            </span>
          </label>
          <textarea
            id="suggested-description"
            readOnly
            rows={5}
            defaultValue={audit.suggestedDescription}
            className="border-line bg-paper rounded-lg border p-3 text-sm"
          />
        </div>
      )}

      {done.length > 0 && (
        <details className="text-sm">
          <summary className="text-ink-muted cursor-pointer">
            {done.length} {done.length === 1 ? "check passes" : "checks pass"}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {done.map((i) => (
              <li key={i.key}>
                <span className="text-success font-medium">✓ {i.title}</span>{" "}
                <span className="text-ink-muted">— {i.facts}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-line flex flex-wrap items-start gap-6 border-t pt-4">
        {open.length > 0 &&
          (canWord ? (
            <ActionForm
              action={wordAuditAction.bind(null, clientId, audit.id)}
              label={hasAi ? "Rewrite fixes with AI" : "Write fixes with AI"}
              pendingLabel="Writing… (can take a minute)"
              variant="primary"
            />
          ) : (
            <p className="text-ink-muted max-w-sm text-sm">
              AI-worded fixes switch on once an Anthropic API key is added (ANTHROPIC_API_KEY). The
              standard fixes above work without it.
            </p>
          ))}
        <ActionForm
          action={runAuditAction.bind(null, clientId, locationId)}
          label="Re-score"
          pendingLabel="Scoring…"
        />
      </div>
      {audit.aiModel && audit.aiWordedAt && (
        <p className="text-ink-muted text-xs">
          AI fixes by {audit.aiModel}, {dateFmt.format(new Date(audit.aiWordedAt))}.
        </p>
      )}
    </>
  );
}
