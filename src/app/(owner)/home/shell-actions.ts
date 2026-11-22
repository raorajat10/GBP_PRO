"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { getOwnerContext, OWNER_BUSINESS_COOKIE } from "@/lib/owner/context";

/** Switch the business the owner portal shows. Only the owner's own businesses are accepted. */
export async function selectBusiness(fd: FormData): Promise<void> {
  const id = z.uuid().safeParse(fd.get("clientId"));
  if (!id.success) return;
  const ctx = await getOwnerContext();
  if (!ctx.businesses.some((b) => b.id === id.data)) return;
  (await cookies()).set(OWNER_BUSINESS_COOKIE, id.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
}
