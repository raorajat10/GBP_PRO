"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { canManageClient } from "@/lib/gbp/service";
import { publishNow } from "@/lib/posts/publish";
import { postClientId } from "@/lib/posts/service";

interface State {
  ok?: boolean;
  message?: string;
}

/** Team: publish an approved post now, or retry a failed one. */
export async function publishNowAction(clientId: string, postId: string): Promise<State> {
  const user = await requireUser(["admin", "manager"]);
  if (
    !z.uuid().safeParse(clientId).success ||
    !z.uuid().safeParse(postId).success ||
    !(await canManageClient(clientId, user.role)) ||
    (await postClientId(postId)) !== clientId
  ) {
    return { message: "You can't publish this post." };
  }
  const outcome = await publishNow(postId);
  refresh();
  switch (outcome.result) {
    case "published":
      return { ok: true, message: "Published on Google." };
    case "retry":
      return { message: `Google didn't take it yet (${outcome.error}). We'll try again soon.` };
    case "failed":
      return { message: outcome.error };
    default:
      return {
        message:
          outcome.reason === "no_profile"
            ? "Link this client's Google profile first. The post stays scheduled until then."
            : "This post isn't waiting to be published.",
      };
  }
}
