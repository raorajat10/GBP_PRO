import type { Metadata } from "next";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { signedPhotoUrls } from "@/lib/posts/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { PhotoUploadForm } from "@/components/owner/photo-upload-form";
import { Empty, fmtDate, NoBusiness, PageHeader, Panel, Pill } from "@/components/owner/ui";
import { removePostBankItem } from "./actions";

export const metadata: Metadata = { title: "Post bank" };

const STATUS = {
  submitted: { label: "With our team", tone: "accent" },
  used: { label: "Used", tone: "success" },
  declined: { label: "Not used", tone: "muted" },
} as const;

export default function PostBankPage() {
  return (
    <>
      <PageHeader
        title="Post bank"
        description="Upload photos of your work, add a note and a date if you like. Our team turns them into posts and sends each one to you for approval."
      />
      <Panel title="Add a photo">
        <PhotoUploadForm withDate submitLabel="Add to post bank" />
      </Panel>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Bank />
      </Suspense>
    </>
  );
}

async function Bank() {
  const { business } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("post_bank_items")
    .select("id, caption, wanted_on, status, created_at, media:media_assets(storage_path)")
    .eq("client_id", business.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const items = data ?? [];
  // Rows came through row-level security, so signing their photos is safe.
  const urls = await signedPhotoUrls(
    items.map((i) => i.media?.storage_path).filter((x): x is string => Boolean(x)),
  );
  const planned = items
    .filter((i) => i.wanted_on && i.status === "submitted")
    .sort((a, b) => a.wanted_on!.localeCompare(b.wanted_on!));
  const rest = items.filter((i) => !(i.wanted_on && i.status === "submitted"));

  const card = (i: (typeof items)[number]) => {
    const s = STATUS[i.status as keyof typeof STATUS] ?? STATUS.submitted;
    const url = i.media ? urls.get(i.media.storage_path) : undefined;
    return (
      <li
        key={i.id}
        className="border-line bg-surface flex flex-col overflow-hidden rounded-2xl border"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <div className="bg-paper aspect-square w-full" />
        )}
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill tone={s.tone}>{s.label}</Pill>
            <span className="text-ink-muted text-xs">
              {i.wanted_on ? `For ${fmtDate(i.wanted_on)}` : `Sent ${fmtDate(i.created_at)}`}
            </span>
          </div>
          {i.caption && <p className="line-clamp-3 text-sm">{i.caption}</p>}
          {i.status === "submitted" && (
            <form action={removePostBankItem} className="mt-auto">
              <input type="hidden" name="id" value={i.id} />
              <button type="submit" className="text-danger text-sm hover:underline">
                Remove
              </button>
            </form>
          )}
        </div>
      </li>
    );
  };

  if (!items.length) {
    return (
      <Panel>
        <Empty>Nothing in your post bank yet. Photos of finished jobs make the best posts.</Empty>
      </Panel>
    );
  }
  return (
    <>
      {planned.length > 0 && (
        <Panel title="Planned" description="Photos you want posted on a date, soonest first">
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {planned.map(card)}
          </ul>
        </Panel>
      )}
      {rest.length > 0 && (
        <Panel title={planned.length ? "Other photos" : "Your photos"}>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{rest.map(card)}</ul>
        </Panel>
      )}
    </>
  );
}
