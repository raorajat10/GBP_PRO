"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ApprovalError, cancelApproval, sendPostForApproval } from "@/lib/approvals/service";
import { requireUser } from "@/lib/auth/dal";
import { canManageClient } from "@/lib/gbp/service";
import { postClientId } from "@/lib/posts/service";

export interface SendState {
  ok?: boolean;
  message?: string;
  link?: string;
  whatsappError?: string | null;
}

async function allowed(clientId: string, postId: string) {
  const user = await requireUser(["admin", "manager"]);
  if (
    !z.uuid().safeParse(clientId).success ||
    !z.uuid().safeParse(postId).success ||
    !(await canManageClient(clientId, user.role)) ||
    (await postClientId(postId)) !== clientId
  ) {
    return null;
  }
  return user;
}

export async function sendForApprovalAction(
  clientId: string,
  postId: string,
  _prev: SendState,
  _fd: FormData,
): Promise<SendState> {
  const user = await allowed(clientId, postId);
  if (!user) return { message: "You don't have access to this post." };
  try {
    const r = await sendPostForApproval({ postId, userId: user.id });
    // No refresh here: the link is shown only once, so the page must stay as it is until the
    // manager has copied it and clicks "Done".
    return {
      ok: true,
      link: r.link,
      whatsappError: r.whatsappError,
      message:
        r.channel === "whatsapp" && !r.whatsappError
          ? "Sent to the owner on WhatsApp."
          : "Approval link created. Send it to the owner.",
    };
  } catch (e) {
    if (e instanceof ApprovalError) return { message: e.message };
    console.error(e);
    return { message: "Something went wrong. Please try again." };
  }
}

export async function cancelApprovalAction(
  clientId: string,
  postId: string,
  _prev: SendState,
  _fd: FormData,
): Promise<SendState> {
  if (!(await allowed(clientId, postId))) return { message: "You don't have access to this post." };
  try {
    await cancelApproval(postId);
  } catch (e) {
    return { message: e instanceof ApprovalError ? e.message : "Something went wrong." };
  }
  refresh();
  return { ok: true, message: "Request cancelled. The post is a draft again." };
}
