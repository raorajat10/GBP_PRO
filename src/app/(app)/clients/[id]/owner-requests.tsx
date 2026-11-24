import { changeAreaLabel } from "@/lib/owner/forms";
import { labelOf, TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/owner/support";
import { signedPhotoUrls } from "@/lib/posts/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setChangeRequestStatus, setPostBankStatus, updateTicket } from "../owner-request-actions";
import { addPhotoToGoogleAction } from "../listing-actions";
import { PHOTO_CATEGORIES } from "@/lib/gbp/listing-edit";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});
const d = (iso: string) => dateFmt.format(new Date(iso));
const btn = "border-line hover:bg-paper rounded-lg border px-2.5 py-1 text-xs font-medium";

/** What the owner sent from their portal: listing changes, support tickets, photos. */
export async function OwnerRequests({ clientId }: { clientId: string }) {
  const supabase = await createSupabaseServerClient();
  const [changes, tickets, bank] = await Promise.all([
    supabase
      .from("change_requests")
      .select("id, area, message, status, created_at")
      .eq("client_id", clientId)
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("support_tickets")
      .select("id, subject, category, priority, description, status, team_reply, created_at")
      .eq("client_id", clientId)
      .neq("status", "resolved")
      .order("created_at"),
    supabase
      .from("post_bank_items")
      .select("id, caption, wanted_on, status, created_at, media:media_assets(storage_path)")
      .eq("client_id", clientId)
      .eq("status", "submitted")
      .order("created_at"),
  ]);
  const urls = await signedPhotoUrls(
    (bank.data ?? []).map((b) => b.media?.storage_path).filter((x): x is string => Boolean(x)),
  );
  const total =
    (changes.data?.length ?? 0) + (tickets.data?.length ?? 0) + (bank.data?.length ?? 0);

  return (
    <section
      aria-labelledby="owner-requests-h"
      className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5"
    >
      <div>
        <h2 id="owner-requests-h" className="text-lg font-bold">
          Owner requests{" "}
          {total > 0 && (
            <span className="bg-accent-soft ml-1 rounded-full px-2 py-0.5 text-sm">{total}</span>
          )}
        </h2>
        <p className="text-ink-muted text-sm">
          Sent by the owner from their portal. Handle them and they see the status.
        </p>
      </div>
      {total === 0 && <p className="text-ink-muted text-sm">Nothing waiting.</p>}

      {!!changes.data?.length && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Profile changes</h3>
          <ul className="flex flex-col gap-2">
            {changes.data.map((c) => (
              <li key={c.id} className="border-line flex flex-col gap-2 rounded-xl border p-3">
                <p className="text-sm">
                  <span className="font-semibold">{changeAreaLabel(c.area)}</span>
                  <span className="text-ink-muted">, {d(c.created_at)}</span>
                </p>
                <p className="text-sm whitespace-pre-line">{c.message}</p>
                <form action={setChangeRequestStatus} className="flex gap-2">
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    name="status"
                    value="done"
                    className={`${btn} border-success text-success`}
                  >
                    Done on Google
                  </button>
                  <button name="status" value="declined" className={btn}>
                    Not possible
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!tickets.data?.length && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Support tickets</h3>
          <ul className="flex flex-col gap-2">
            {tickets.data.map((t) => (
              <li key={t.id} className="border-line flex flex-col gap-2 rounded-xl border p-3">
                <p className="text-sm">
                  <span className="font-semibold">{t.subject}</span>
                  <span className="text-ink-muted">
                    , {labelOf(TICKET_CATEGORIES, t.category)},{" "}
                    {labelOf(TICKET_PRIORITIES, t.priority)}, {d(t.created_at)}
                  </span>
                </p>
                <p className="text-sm whitespace-pre-line">{t.description}</p>
                <form action={updateTicket} className="flex flex-col gap-2">
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="id" value={t.id} />
                  <label className="sr-only" htmlFor={`reply-${t.id}`}>
                    Reply to owner
                  </label>
                  <textarea
                    id={`reply-${t.id}`}
                    name="reply"
                    rows={2}
                    defaultValue={t.team_reply ?? ""}
                    placeholder="Reply to the owner (they see it in their portal)"
                    className="border-line bg-surface rounded-lg border px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button name="status" value="in_progress" className={btn}>
                      Reply, still working
                    </button>
                    <button
                      name="status"
                      value="resolved"
                      className={`${btn} border-success text-success`}
                    >
                      Reply and resolve
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!bank.data?.length && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Photos from the owner</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {bank.data.map((b) => {
              const url = b.media ? urls.get(b.media.storage_path) : undefined;
              return (
                <li
                  key={b.id}
                  className="border-line flex flex-col overflow-hidden rounded-xl border"
                >
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="aspect-square w-full object-cover" />
                    </a>
                  )}
                  <div className="flex flex-col gap-1.5 p-2 text-xs">
                    <p className="text-ink-muted">
                      {b.wanted_on ? `Wants it on ${d(b.wanted_on)}` : `Sent ${d(b.created_at)}`}
                    </p>
                    {b.caption && <p className="line-clamp-3">{b.caption}</p>}
                    <form
                      action={addPhotoToGoogleAction}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <input type="hidden" name="clientId" value={clientId} />
                      <input type="hidden" name="id" value={b.id} />
                      <label className="sr-only" htmlFor={`cat-${b.id}`}>
                        Photo type
                      </label>
                      <select
                        id={`cat-${b.id}`}
                        name="category"
                        defaultValue="AT_WORK"
                        className="border-line bg-surface rounded border px-1 py-0.5 text-xs"
                      >
                        {PHOTO_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button className={`${btn} border-primary text-primary`}>
                        Add to Google photos
                      </button>
                    </form>
                    <form action={setPostBankStatus} className="flex gap-1.5">
                      <input type="hidden" name="clientId" value={clientId} />
                      <input type="hidden" name="id" value={b.id} />
                      <button
                        name="status"
                        value="used"
                        className={`${btn} border-success text-success`}
                      >
                        Used
                      </button>
                      <button name="status" value="declined" className={btn}>
                        Skip
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
