"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { canManageClient, locationTarget } from "@/lib/gbp/service";
import { GbpError } from "@/lib/gbp/types";
import { MAX_REPLY_LENGTH } from "@/lib/reviews/language";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** A review this team member may act on, read through row-level security. */
async function reviewFor(reviewId: unknown) {
  const user = await requireUser(["admin", "manager"]);
  const id = z.uuid().safeParse(reviewId);
  if (!id.success) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, client_id, location_id, gbp_review_name")
    .eq("id", id.data)
    .maybeSingle();
  if (!data || !(await canManageClient(data.client_id, user.role))) return null;
  return data;
}

export interface PostState {
  ok?: boolean;
  message?: string;
}

/** Post the team's final reply to Google (replaces any earlier reply). */
export async function postReplyAction(
  reviewId: string,
  _prev: PostState,
  fd: FormData,
): Promise<PostState> {
  const review = await reviewFor(reviewId);
  if (!review) return { message: "Review not found." };
  const text = String(fd.get("reply") ?? "").trim();
  if (text.length < 2) return { message: "Write a reply first." };
  if (text.length > MAX_REPLY_LENGTH) {
    return {
      message: `Keep the reply under ${MAX_REPLY_LENGTH.toLocaleString("en-IN")} characters.`,
    };
  }
  try {
    const target = await locationTarget(review.location_id);
    let saved;
    try {
      saved = await target.provider.replyToReview(target.creds, review.gbp_review_name, text);
    } catch (e) {
      await target.onAuthError(e);
      throw e;
    }
    await createSupabaseAdminClient()
      .from("reviews")
      .update({ reply_comment: saved.comment, replied_at: saved.updateTime })
      .eq("id", review.id);
  } catch (e) {
    if (e instanceof GbpError) return { message: e.message };
    console.error("Posting reply failed", e);
    return { message: "Couldn't reach Google. Try again." };
  }
  refresh();
  return { ok: true, message: "Reply posted on Google." };
}
