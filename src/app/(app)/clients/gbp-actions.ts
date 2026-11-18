"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import {
  canManageClient,
  linkLocation,
  locationBelongsTo,
  syncLocation,
  unlinkLocation,
} from "@/lib/gbp/service";
import { GbpError } from "@/lib/gbp/types";
import type { FormState } from "./actions";

const failure = (e: unknown): FormState => ({
  message: e instanceof GbpError ? e.message : "Something went wrong. Please try again.",
});

export async function linkProfileAction(
  clientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success || !(await canManageClient(clientId, user.role))) {
    return { message: "You don't have access to this client." };
  }
  const [connectionId, locationName] = String(fd.get("profile") ?? "").split("|");
  if (
    !z.uuid().safeParse(connectionId).success ||
    !/^locations\/[\w-]+$/.test(locationName ?? "")
  ) {
    return { message: "Choose a profile from the list." };
  }
  try {
    await linkLocation({ clientId, connectionId, locationName, userId: user.id });
  } catch (e) {
    return failure(e);
  }
  // The link form is replaced by the profile summary, so confirm with the page banner.
  redirect(`/clients/${clientId}?gbp=linked`);
}

export async function syncProfileAction(
  clientId: string,
  locationId: string,
  _prev: FormState,
  _fd: FormData,
): Promise<FormState> {
  const user = await requireUser(["admin", "manager"]);
  if (
    !(await canManageClient(clientId, user.role)) ||
    !(await locationBelongsTo(locationId, clientId))
  ) {
    return { message: "You don't have access to this profile." };
  }
  try {
    await syncLocation(locationId, user.id);
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { ok: true, message: "Synced just now." };
}

export async function unlinkProfileAction(
  clientId: string,
  locationId: string,
  _prev: FormState,
  _fd: FormData,
): Promise<FormState> {
  await requireUser(["admin"]);
  if (!(await locationBelongsTo(locationId, clientId))) {
    return { message: "This profile isn't linked to this client." };
  }
  try {
    await unlinkLocation(locationId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/clients/${clientId}?gbp=unlinked`);
}
