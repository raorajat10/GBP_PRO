"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerBusiness } from "@/lib/owner/context";
import type { OwnerFormState } from "@/lib/owner/forms";
import { GRID_SIZES } from "@/lib/rank/grid";
import { RankError } from "@/lib/rank/provider";
import { addKeyword, removeKeyword, runScan } from "@/lib/rank/service";

const RADIUS_CHOICES = [1, 2, 5, 10, 15, 25] as const;

const keywordSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(2, "Type what customers search for, e.g. solar company in jaipur.")
    .max(80, "Keep it under 80 characters."),
  gridSize: z.coerce.number().refine((n) => (GRID_SIZES as readonly number[]).includes(n), "Pick a grid size."),
  radiusKm: z.coerce.number().refine((n) => (RADIUS_CHOICES as readonly number[]).includes(n), "Pick a distance."),
});

export async function addKeywordAction(_: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  const parsed = keywordSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { user, business } = await requireOwnerBusiness();
  try {
    await addKeyword({
      clientId: business.id,
      keyword: parsed.data.keyword.toLowerCase(),
      gridSize: parsed.data.gridSize as 3 | 5 | 7,
      radiusKm: parsed.data.radiusKm,
      userId: user.id,
    });
  } catch (e) {
    if (e instanceof RankError) return { message: e.message };
    throw e;
  }
  refresh();
  return { ok: true, message: "Keyword added. Press Scan now to see your grid." };
}

export async function removeKeywordAction(fd: FormData): Promise<void> {
  const id = z.uuid().safeParse(fd.get("keywordId"));
  if (!id.success) return;
  const { business } = await requireOwnerBusiness();
  await removeKeyword(business.id, id.data);
  redirect("/home/insights/grid");
}

export async function scanNowAction(_: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  const id = z.uuid().safeParse(fd.get("keywordId"));
  if (!id.success) return { message: "Pick a keyword first." };
  const { user, business } = await requireOwnerBusiness();
  let scanId: string;
  try {
    ({ scanId } = await runScan({ clientId: business.id, keywordId: id.data, userId: user.id }));
  } catch (e) {
    if (e instanceof RankError) return { message: e.message };
    console.error(e);
    return { message: "The scan failed. Try again later." };
  }
  redirect(`/home/insights/grid?k=${id.data}&scan=${scanId}`);
}
