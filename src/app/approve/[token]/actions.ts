"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { ApprovalError, respondByToken } from "@/lib/approvals/service";
import { publishDuePosts } from "@/lib/posts/publish";

export interface AnswerState {
  ok?: boolean;
  message?: string;
}

/** No login: the single-use token in the link is the permission. */
export async function answerAction(
  token: string,
  _prev: AnswerState,
  fd: FormData,
): Promise<AnswerState> {
  const decision = fd.get("decision");
  const note = String(fd.get("note") ?? "").trim();
  if (decision !== "approved" && decision !== "changes_requested") {
    return { message: "Choose Approve or Request change." };
  }
  if (decision === "changes_requested" && note.length < 3) {
    return { message: "Tell us what to change, so our team can fix it." };
  }
  if (note.length > 1000) return { message: "Keep the note under 1,000 characters." };
  try {
    await respondByToken(token, decision, decision === "changes_requested" ? note : null);
  } catch (e) {
    return {
      message: e instanceof ApprovalError ? e.message : "Something went wrong. Please try again.",
    };
  }
  // An approved post that is already due goes to Google right away, after the owner
  // has their answer (the response is not held up by Google).
  if (decision === "approved") {
    after(async () => {
      try {
        await publishDuePosts();
      } catch (e) {
        console.error("Publishing after approval failed", e);
      }
    });
  }
  refresh();
  return { ok: true };
}
