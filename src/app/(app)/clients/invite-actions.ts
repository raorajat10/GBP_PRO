"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { serverEnv } from "@/lib/env";
import { cancelInvite, createInvite, InviteError } from "@/lib/gbp/invites";
import { canManageClient } from "@/lib/gbp/service";

export interface InviteState {
  ok?: boolean;
  message?: string;
  link?: string;
  emailError?: string | null;
}

async function allowed(clientId: string) {
  const user = await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success || !(await canManageClient(clientId, user.role))) {
    return null;
  }
  return user;
}

export async function createInviteAction(
  clientId: string,
  _prev: InviteState,
  fd: FormData,
): Promise<InviteState> {
  const user = await allowed(clientId);
  if (!user) return { message: "You don't have access to this client." };
  const raw = String(fd.get("email") ?? "").trim();
  const email = raw ? z.email().safeParse(raw) : null;
  if (email && !email.success)
    return { message: "Enter a valid email address, or leave it empty." };
  try {
    const r = await createInvite({
      clientId,
      userId: user.id,
      email: email?.data ?? null,
      appUrl: serverEnv().APP_URL,
    });
    // No refresh: the link is shown only once, so keep it on screen until "Done".
    return {
      ok: true,
      link: r.link,
      emailError: r.emailError,
      message:
        r.emailStatus === "sent"
          ? `Invite emailed to ${email!.data}. You can also share the link below.`
          : "Invite link created. Send it to the owner.",
    };
  } catch (e) {
    return { message: e instanceof InviteError ? e.message : "Something went wrong. Try again." };
  }
}

export async function cancelInviteAction(
  clientId: string,
  inviteId: string,
  _prev: InviteState,
  _fd: FormData,
): Promise<InviteState> {
  if (!(await allowed(clientId)) || !z.uuid().safeParse(inviteId).success) {
    return { message: "You don't have access to this client." };
  }
  try {
    await cancelInvite(inviteId, clientId);
  } catch (e) {
    return { message: e instanceof InviteError ? e.message : "Something went wrong." };
  }
  refresh();
  return { ok: true, message: "Invite cancelled." };
}
