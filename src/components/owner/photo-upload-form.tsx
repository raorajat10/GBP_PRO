"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { OwnerFormState } from "@/lib/owner/forms";
import { addToPostBank } from "@/app/(owner)/home/grow/post-bank/actions";

const MAX_SIDE = 1600;

/** Shrink phone photos in the browser first so they upload fast on mobile data. */
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  } catch {
    return null;
  }
}

/** Send one photo to our team, with an optional note and (for posts) a date. */
export function PhotoUploadForm({
  withDate,
  defaultCaption = "",
  captionLabel = "Note for our team (optional)",
  submitLabel = "Send to our team",
}: {
  withDate: boolean;
  defaultCaption?: string;
  captionLabel?: string;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<OwnerFormState, FormData>(addToPostBank, {});
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const ids = { photo: useId(), caption: useId(), date: useId() };

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  // Clear the form after a successful send.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setPhoto(null);
  }
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  async function onPhoto(file: File | undefined) {
    setPhoto(null);
    setNote(null);
    if (!file) return;
    const blob = (await shrink(file)) ?? file;
    if (blob.size > 4 * 1024 * 1024) {
      setNote("That photo is too large. Use one under 4 MB.");
      return;
    }
    setPhoto({ blob, url: URL.createObjectURL(blob) });
  }

  const photoError = state.errors?.photo?.[0] ?? note;

  return (
    <form
      ref={form}
      action={(fd) => {
        fd.delete("picker");
        if (photo) fd.set("photo", new File([photo.blob], "photo.jpg", { type: photo.blob.type }));
        return action(fd);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-start gap-4">
        <label
          htmlFor={ids.photo}
          className="border-line hover:border-primary bg-paper flex size-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center text-sm"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="Chosen photo" className="size-full object-cover" />
          ) : (
            <span className="text-ink-muted px-3">Choose a photo</span>
          )}
        </label>
        <input
          id={ids.photo}
          name="picker"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
        <div className="flex min-w-56 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.caption} className="text-sm font-medium">
              {captionLabel}
            </label>
            <textarea
              id={ids.caption}
              name="caption"
              rows={2}
              maxLength={1000}
              defaultValue={defaultCaption}
              placeholder="For example: 5 kW rooftop system we finished in Bagru last week."
              className="border-line bg-surface rounded-lg border px-3 py-2 text-sm"
            />
            {state.errors?.caption && (
              <p className="text-danger text-sm">{state.errors.caption[0]}</p>
            )}
          </div>
          {withDate && (
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.date} className="text-sm font-medium">
                Post on (optional)
              </label>
              <input
                id={ids.date}
                name="wantedOn"
                type="date"
                className="border-line bg-surface w-48 rounded-lg border px-3 py-2 text-sm"
              />
              {state.errors?.wantedOn && (
                <p className="text-danger text-sm">{state.errors.wantedOn[0]}</p>
              )}
            </div>
          )}
        </div>
      </div>
      {photoError && <p className="text-danger text-sm">{photoError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !photo}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
        >
          {pending ? "Uploading…" : submitLabel}
        </button>
        <span className="text-ink-muted text-xs">JPG or PNG, at least 250×250 pixels.</span>
        {state.message && (
          <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
