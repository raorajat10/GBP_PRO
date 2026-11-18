"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, inputClass } from "@/components/form-field";
import { LANGUAGES } from "@/lib/clients/schema";
import { TOPIC_TYPES } from "@/lib/posts/rules";
import type { FormState } from "../../../actions";

const MAX_SIDE = 1600;

/**
 * Shrink the photo in the browser before upload, so phone photos (often 5–10 MB) upload
 * fast on mobile data. The server checks and re-encodes it again either way.
 */
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
    return null; // e.g. a format this browser can't open — the server will explain
  }
}

export function NewPostForm({
  action,
  defaultLanguage,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaultLanguage: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  // Controlled, so a validation error doesn't wipe what was typed (forms reset after an action).
  const [note, setNote] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [topicType, setTopicType] = useState("STANDARD");
  const e = state.fieldErrors ?? {};

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  async function onPhoto(file: File | undefined) {
    setPhoto(null);
    setPhotoNote(null);
    if (!file) return;
    const blob = (await shrink(file)) ?? file;
    if (blob.size > 4 * 1024 * 1024) {
      setPhotoNote("That photo is too large. Use one under 4 MB.");
      return;
    }
    setPhoto({ blob, url: URL.createObjectURL(blob) });
  }

  return (
    <form
      action={(fd) => {
        fd.delete("photoPicker");
        if (photo) fd.set("photo", new File([photo.blob], "photo.jpg", { type: photo.blob.type }));
        formAction(fd);
      }}
      className="border-line bg-surface flex flex-col gap-5 rounded-2xl border p-5"
      noValidate
    >
      <Field
        label="Photo (optional, recommended)"
        name="photoPicker"
        hint="JPG or PNG, at least 250×250 pixels. Big phone photos are shrunk automatically."
        errors={e.photo ?? (photoNote ? [photoNote] : undefined)}
      >
        <input
          id="photoPicker"
          name="photoPicker"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(ev) => onPhoto(ev.target.files?.[0])}
          className={inputClass}
        />
      </Field>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- local preview
        <img
          src={photo.url}
          alt="Selected photo"
          className="border-line max-h-64 w-fit max-w-full rounded-lg border object-contain"
        />
      )}

      <Field
        label="What is this post about?"
        name="note"
        hint="A line or two is enough, e.g. “Exide inverter battery offer, 2-year warranty”. Don't include phone numbers."
        errors={e.note}
      >
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={1000}
          required
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          className={inputClass}
          aria-invalid={Boolean(e.note)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Language" name="language" errors={e.language}>
          <select
            id="language"
            name="language"
            value={language}
            onChange={(ev) => setLanguage(ev.target.value)}
            className={inputClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type of post" name="topicType" errors={e.topicType}>
          <select
            id="topicType"
            name="topicType"
            value={topicType}
            onChange={(ev) => setTopicType(ev.target.value)}
            className={inputClass}
          >
            {TOPIC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
        >
          {pending ? "Writing drafts… (up to a minute)" : "Write 3 drafts"}
        </button>
        {state.message && (
          <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
