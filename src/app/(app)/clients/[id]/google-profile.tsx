import Link from "next/link";
import { formatIst } from "@/lib/approvals/format";
import { listInvites } from "@/lib/gbp/invites";
import { listLinkCandidates } from "@/lib/gbp/service";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { inputClass } from "@/components/form-field";
import { linkProfileAction, syncProfileAction, unlinkProfileAction } from "../gbp-actions";
import { cancelInviteAction, createInviteAction } from "../invite-actions";
import { AuditSection } from "./audit-section";
import { CancelInviteButton, InviteForm } from "./invite-form";

const nf = new Intl.NumberFormat("en-IN");

function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-line bg-paper flex flex-col rounded-xl border px-3 py-2">
      <span className="text-ink-muted text-xs">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
      {note && <span className="text-ink-muted text-xs">{note}</span>}
    </div>
  );
}

/** Caller must already have checked the user can manage this client. */
export async function GoogleProfileSection({
  clientId,
  isAdmin,
}: {
  clientId: string;
  isAdmin: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: location } = await supabase
    .from("locations")
    .select("id, title, primary_category, synced_at, snapshot")
    .eq("client_id", clientId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return (
    <>
      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5">
        <h2 className="text-lg font-semibold">Google Business Profile</h2>
        {location ? (
          <Linked
            clientId={clientId}
            isAdmin={isAdmin}
            location={{ ...location, snapshot: location.snapshot as unknown as LocationSnapshot }}
          />
        ) : (
          <NotLinked clientId={clientId} isAdmin={isAdmin} />
        )}
      </section>
      {location && <AuditSection clientId={clientId} locationId={location.id} />}
    </>
  );
}

function Linked({
  clientId,
  isAdmin,
  location,
}: {
  clientId: string;
  isAdmin: boolean;
  location: {
    id: string;
    title: string;
    primary_category: string | null;
    synced_at: string;
    snapshot: LocationSnapshot;
  };
}) {
  const s = location.snapshot;
  const area = s.profile.address?.addressLines.at(-1);
  const replyRate = s.reviews.replyRateLast90Days;

  return (
    <>
      <div>
        <p className="font-semibold">{location.title}</p>
        <p className="text-ink-muted text-sm">
          {[location.primary_category, area].filter(Boolean).join(" · ")} · synced{" "}
          {ago(location.synced_at)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Rating"
          value={s.reviews.average !== null ? `★ ${s.reviews.average}` : "—"}
          note={`${nf.format(s.reviews.total)} reviews`}
        />
        <Stat
          label="Unanswered reviews"
          value={nf.format(s.reviews.unanswered)}
          note={
            replyRate !== null ? `${Math.round(replyRate * 100)}% replied (90 days)` : undefined
          }
        />
        <Stat
          label="Photos"
          value={nf.format(s.photos.total)}
          note={`${s.photos.last30Days} in last 30 days`}
        />
        <Stat label="Posts (30 days)" value={nf.format(s.posts.last30Days)} />
        <Stat
          label="Profile views"
          value={nf.format(s.metrics.impressions)}
          note={`last ${s.metrics.days} days`}
        />
        <Stat
          label="Calls"
          value={nf.format(s.metrics.calls)}
          note={`last ${s.metrics.days} days`}
        />
        <Stat
          label="Direction requests"
          value={nf.format(s.metrics.directionRequests)}
          note={`last ${s.metrics.days} days`}
        />
        <Stat
          label="Website clicks"
          value={nf.format(s.metrics.websiteClicks)}
          note={`last ${s.metrics.days} days`}
        />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <ActionForm
          action={syncProfileAction.bind(null, clientId, location.id)}
          label="Sync now"
          pendingLabel="Syncing…"
        />
        {isAdmin && (
          <ActionForm
            action={unlinkProfileAction.bind(null, clientId, location.id)}
            label="Unlink"
            pendingLabel="Unlinking…"
            variant="danger"
            confirm={`Unlink "${location.title}" from this client?`}
          />
        )}
      </div>
    </>
  );
}

async function NotLinked({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const supabase = await createSupabaseServerClient();
  const [groups, { data: client }] = await Promise.all([
    listLinkCandidates(clientId),
    supabase.from("clients").select("business_name").eq("id", clientId).single(),
  ]);
  const businessName = client?.business_name ?? "your business";
  const hasTeamAccount = groups.some((g) => g.mode === "agency_manager");
  const options = groups.flatMap((g) => g.locations);

  return (
    <>
      <p className="text-ink-muted text-sm">
        Not linked yet. Pick the client&apos;s profile below.
      </p>

      {options.length > 0 && (
        <ActionForm
          action={linkProfileAction.bind(null, clientId)}
          label="Link profile"
          pendingLabel="Linking…"
          variant="primary"
        >
          <label className="flex min-w-64 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">Google profile</span>
            <select name="profile" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {groups.map((g) =>
                g.locations.length ? (
                  <optgroup key={g.connectionId} label={g.label}>
                    {g.locations.map((l) => (
                      <option key={l.name} value={`${g.connectionId}|${l.name}`}>
                        {l.title}
                        {l.area ? ` — ${l.area}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
          </label>
        </ActionForm>
      )}

      {groups
        .filter((g) => g.error)
        .map((g) => (
          <p key={g.connectionId} className="text-danger text-sm">
            {g.label}: {g.error}
          </p>
        ))}

      {!hasTeamAccount && (
        <p className="text-sm">
          No team Google account is connected yet.{" "}
          {isAdmin ? (
            <Link href="/settings" className="text-primary font-medium underline">
              Connect it in Settings
            </Link>
          ) : (
            "Ask an admin to connect it in Settings."
          )}
        </p>
      )}
      {hasTeamAccount && options.length === 0 && (
        <p className="text-ink-muted text-sm">
          No unlinked profiles on the team account. Ask the owner to add our team Google account as
          a Manager on their Business Profile, then come back here.
        </p>
      )}

      <div className="border-line flex flex-col gap-3 border-t pt-4">
        <div>
          <p className="text-sm font-medium">
            Or: ask the owner to approve access from their phone
          </p>
          <p className="text-ink-muted text-sm">
            They get a private link (by email, or you share it on WhatsApp), sign in with the Google
            account that owns the profile, and approve. The profile then links here automatically.
            The link works once and expires in 7 days.
          </p>
        </div>
        <InviteForm action={createInviteAction.bind(null, clientId)} businessName={businessName} />
        <InviteList clientId={clientId} />
      </div>

      <div className="border-line flex flex-col gap-2 border-t pt-4">
        <p className="text-sm">
          <span className="font-medium">Or: you&apos;re with the owner right now.</span>{" "}
          <span className="text-ink-muted">They sign in on this device.</span>
        </p>
        <a
          href={`/api/gbp/connect?mode=owner&clientId=${clientId}`}
          className="border-line hover:bg-paper w-fit rounded-lg border px-4 py-2 text-sm"
        >
          Connect owner&apos;s Google account
        </a>
      </div>
    </>
  );
}

const inviteStatus: Record<string, string> = {
  pending: "Waiting for the owner",
  used: "Approved ✓",
  cancelled: "Cancelled",
  expired: "Expired",
};

async function InviteList({ clientId }: { clientId: string }) {
  const invites = await listInvites(clientId);
  if (!invites.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label="Recent invites">
      {invites.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">{formatIst(new Date(i.createdAt))}</span>
          <span>{i.sentToEmail ?? "link only"}</span>
          {i.emailStatus === "failed" && <span className="text-danger">(email failed)</span>}
          <span className="font-medium">{inviteStatus[i.status]}</span>
          {i.status === "pending" && (
            <CancelInviteButton action={cancelInviteAction.bind(null, clientId, i.id)} />
          )}
        </li>
      ))}
    </ul>
  );
}
