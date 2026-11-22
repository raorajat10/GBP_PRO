import { changeAreaLabel } from "@/lib/owner/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmtDate, Panel, Pill } from "./ui";

const STATUS = {
  open: { label: "With our team", tone: "accent" },
  done: { label: "Done", tone: "success" },
  declined: { label: "Not possible", tone: "muted" },
} as const;

/** The owner's recent change requests, so they can see what happened to each. */
export async function ChangeRequestList({
  clientId,
  areas,
}: {
  clientId: string;
  areas?: string[];
}) {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("change_requests")
    .select("id, area, message, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (areas) q = q.in("area", areas);
  const { data } = await q;
  if (!data?.length) return null;
  return (
    <Panel title="Your requests" description="Changes you asked our team to make on Google">
      <ul className="divide-line flex flex-col divide-y">
        {data.map((r) => {
          const s = STATUS[r.status as keyof typeof STATUS] ?? STATUS.open;
          return (
            <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{changeAreaLabel(r.area)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-ink-muted text-xs">{fmtDate(r.created_at)}</span>
                  <Pill tone={s.tone}>{s.label}</Pill>
                </div>
              </div>
              <p className="text-ink-muted text-sm whitespace-pre-line">{r.message}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
