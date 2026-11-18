"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiError } from "@/lib/ai/writer";
import { requireUser } from "@/lib/auth/dal";
import { LANGUAGES } from "@/lib/clients/schema";
import { canManageClient } from "@/lib/gbp/service";
import { PhotoError, PHOTO_RULES } from "@/lib/posts/photo";
import {
  CTA_TYPES,
  hasPhoneNumber,
  ISSUE_TEXT,
  parseIstLocal,
  postIssues,
  scheduleProblem,
  TOPIC_TYPES,
} from "@/lib/posts/rules";
import {
  createPostWithDrafts,
  deletePostDraft,
  PostError,
  postClientId,
  regenerateDrafts,
  savePostDraft,
} from "@/lib/posts/service";
import type { FormState } from "./actions";

const failure = (e: unknown): FormState => {
  if (e instanceof AiError || e instanceof PostError || e instanceof PhotoError) {
    return { message: e.message };
  }
  console.error(e);
  return { message: "Something went wrong. Please try again." };
};

const language = z.enum(LANGUAGES.map((l) => l.value) as ["en", "hi", "hinglish"], {
  error: "Choose a language.",
});

async function allowed(clientId: string, postId?: string) {
  const user = await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success || !(await canManageClient(clientId, user.role))) {
    return null;
  }
  if (postId !== undefined) {
    if (!z.uuid().safeParse(postId).success) return null;
    if ((await postClientId(postId)) !== clientId) return null;
  }
  return user;
}

const newPostSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "Tell the AI what the post is about.")
    .max(1000, "Keep the note under 1,000 characters.")
    .refine((v) => !hasPhoneNumber(v), "Leave phone numbers out. The Call button adds them."),
  language,
  topicType: z.enum(TOPIC_TYPES.map((t) => t.value) as ["STANDARD", "OFFER", "EVENT"]),
});

/** Photo + note → drafts. Opens the editor on success. */
export async function createPostAction(
  clientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await allowed(clientId);
  if (!user) return { message: "You don't have access to this client." };

  const parsed = newPostSchema.safeParse({
    note: fd.get("note"),
    language: fd.get("language"),
    topicType: fd.get("topicType") ?? "STANDARD",
  });
  if (!parsed.success) {
    return {
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const file = fd.get("photo");
  let photo: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > PHOTO_RULES.maxUploadBytes) {
      return { fieldErrors: { photo: ["That photo is too large. Use one under 4 MB."] } };
    }
    photo = Buffer.from(await file.arrayBuffer());
  }

  let postId: string;
  try {
    ({ postId } = await createPostWithDrafts({ clientId, userId: user.id, photo, ...parsed.data }));
  } catch (e) {
    if (e instanceof PhotoError) return { fieldErrors: { photo: [e.message] } };
    return failure(e);
  }
  redirect(`/clients/${clientId}/posts/${postId}`);
}

export async function regenerateDraftsAction(
  clientId: string,
  postId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  if (!(await allowed(clientId, postId))) return { message: "You don't have access to this post." };
  const lang = language.safeParse(fd.get("language"));
  if (!lang.success) return { message: "Choose a language." };
  try {
    await regenerateDrafts({ postId, language: lang.data });
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { ok: true, message: "New drafts written." };
}

const saveSchema = z
  .object({
    body: z.string().trim(),
    ctaType: z
      .enum(CTA_TYPES.map((c) => c.value) as ["CALL", "LEARN_MORE", "BOOK", "ORDER"])
      .nullable(),
    ctaUrl: z.string().trim().nullable(),
    scheduledFor: z.string().trim().nullable(),
  })
  .superRefine((v, ctx) => {
    for (const issue of postIssues(v.body)) {
      ctx.addIssue({ code: "custom", path: ["body"], message: ISSUE_TEXT[issue] });
    }
    const needsUrl = CTA_TYPES.find((c) => c.value === v.ctaType)?.needsUrl;
    if (needsUrl && !z.url({ protocol: /^https$/ }).safeParse(v.ctaUrl ?? "").success) {
      ctx.addIssue({
        code: "custom",
        path: ["ctaUrl"],
        message: "Enter the full web address, starting with https://",
      });
    }
    if (v.scheduledFor) {
      const when = parseIstLocal(v.scheduledFor);
      const problem = when ? scheduleProblem(when) : "Pick a valid date and time.";
      if (problem) ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: problem });
    }
  });

const blankToNull = (v: FormDataEntryValue | null) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

export async function savePostAction(
  clientId: string,
  postId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  if (!(await allowed(clientId, postId))) return { message: "You don't have access to this post." };
  const parsed = saveSchema.safeParse({
    body: fd.get("body") ?? "",
    ctaType: blankToNull(fd.get("ctaType")),
    ctaUrl: blankToNull(fd.get("ctaUrl")),
    scheduledFor: blankToNull(fd.get("scheduledFor")),
  });
  if (!parsed.success) {
    return {
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const v = parsed.data;
  try {
    await savePostDraft({
      postId,
      body: v.body,
      ctaType: v.ctaType,
      ctaUrl: v.ctaUrl,
      scheduledFor: v.scheduledFor ? parseIstLocal(v.scheduledFor) : null,
    });
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { ok: true, message: "Draft saved." };
}

export async function deletePostAction(
  clientId: string,
  postId: string,
  _prev: FormState,
  _fd: FormData,
): Promise<FormState> {
  if (!(await allowed(clientId, postId))) return { message: "You don't have access to this post." };
  try {
    await deletePostDraft(postId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/clients/${clientId}/posts`);
}
